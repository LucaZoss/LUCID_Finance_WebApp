# LUCID Finance - Forecasting Model Integration Guide

This folder contains the machine learning forecasting models for the LUCID Finance application. The models predict future spending patterns, budget recommendations, and financial trends.

## Overview

The forecasting system analyzes historical transaction data to provide:
- **Expense Forecasting**: Predict future spending by category
- **Budget Recommendations**: Suggest optimal budget allocations
- **Anomaly Detection**: Identify unusual spending patterns
- **Cash Flow Predictions**: Project future income and expenses

## Project Structure

```
model/
├── README.md              # This file
├── requirements.txt       # ML-specific dependencies
├── api/
│   └── model_endpoints.py # FastAPI routes for model predictions
├── examples/
│   └── train_forecast_model.py  # Example training script
├── forecasting/
│   ├── __init__.py
│   ├── data_preparation.py      # Data preprocessing for ML
│   ├── expense_forecaster.py    # Expense prediction model
│   └── budget_optimizer.py      # Budget recommendation model
├── models/
│   └── .gitkeep           # Trained model files (.pkl, .h5, etc.)
└── notebooks/
    └── exploratory_analysis.ipynb  # Jupyter notebooks for analysis
```

## Implementation Steps

### 1. Install ML Dependencies

Add these to `pyproject.toml` in the main dependencies:

```toml
[project.dependencies]
# ... existing dependencies ...
"scikit-learn>=1.3.0",
"xgboost>=2.0.0",
"statsmodels>=0.14.0",
"prophet>=1.1.0",        # For time series forecasting
"numpy>=1.24.0",
"joblib>=1.3.0",         # For model serialization
```

Then run:
```bash
uv sync
```

### 2. Create Data Preparation Module

Create `model/forecasting/data_preparation.py`:

```python
from datetime import datetime, timedelta
import pandas as pd
from backend.data_pipeline.models import DatabaseManager, Transaction

class DataPreparator:
    """Prepare transaction data for ML models."""

    def __init__(self):
        self.db_manager = DatabaseManager()

    def get_historical_data(self, user_id: int, months_back: int = 12):
        """Fetch historical transaction data."""
        session = self.db_manager.get_session()
        try:
            cutoff_date = datetime.now() - timedelta(days=months_back * 30)
            transactions = session.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.date >= cutoff_date
            ).all()

            # Convert to DataFrame
            df = pd.DataFrame([{
                'date': t.date,
                'type': t.type,
                'category': t.category,
                'amount': float(t.amount),
                'month': t.month,
                'year': t.year
            } for t in transactions])

            return df
        finally:
            session.close()

    def aggregate_by_category(self, df: pd.DataFrame):
        """Aggregate spending by category and month."""
        return df.groupby(['year', 'month', 'category', 'type']).agg({
            'amount': 'sum'
        }).reset_index()
```

### 3. Create Forecasting Model

Create `model/forecasting/expense_forecaster.py`:

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from prophet import Prophet
import joblib
from pathlib import Path

class ExpenseForecaster:
    """Forecast future expenses using time series analysis."""

    def __init__(self, model_path: Path = None):
        self.model_path = model_path or Path(__file__).parent.parent / "models"
        self.model_path.mkdir(exist_ok=True)
        self.models = {}

    def train_category_model(self, df: pd.DataFrame, category: str):
        """Train a forecasting model for a specific category."""
        # Filter data for category
        cat_data = df[df['category'] == category].copy()

        # Prepare data for Prophet
        cat_data['ds'] = pd.to_datetime(
            cat_data['year'].astype(str) + '-' +
            cat_data['month'].astype(str).str.zfill(2) + '-01'
        )
        cat_data['y'] = cat_data['amount']

        # Train Prophet model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False
        )
        model.fit(cat_data[['ds', 'y']])

        # Save model
        model_file = self.model_path / f"{category.replace(' ', '_')}_model.pkl"
        joblib.dump(model, model_file)

        return model

    def predict_next_months(self, category: str, months: int = 3):
        """Predict expenses for the next N months."""
        model_file = self.model_path / f"{category.replace(' ', '_')}_model.pkl"

        if not model_file.exists():
            raise ValueError(f"No trained model found for {category}")

        model = joblib.load(model_file)

        # Create future dataframe
        future = model.make_future_dataframe(periods=months, freq='MS')
        forecast = model.predict(future)

        # Return last N predictions
        predictions = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(months)

        return [{
            'date': row['ds'].strftime('%Y-%m'),
            'predicted_amount': max(0, row['yhat']),
            'lower_bound': max(0, row['yhat_lower']),
            'upper_bound': max(0, row['yhat_upper'])
        } for _, row in predictions.iterrows()]
```

### 4. Add API Endpoints

Add these routes to `backend/api/main.py` or create `model/api/model_endpoints.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
from model.forecasting.data_preparation import DataPreparator
from model.forecasting.expense_forecaster import ExpenseForecaster
from backend.api.auth import get_current_user

router = APIRouter(prefix="/api/forecast", tags=["forecasting"])

@router.post("/train/{category}")
async def train_category_forecast(
    category: str,
    current_user: dict = Depends(get_current_user)
):
    """Train a forecasting model for a specific category."""
    try:
        preparator = DataPreparator()
        forecaster = ExpenseForecaster()

        # Get historical data
        df = preparator.get_historical_data(current_user['id'], months_back=12)
        aggregated = preparator.aggregate_by_category(df)

        # Train model
        model = forecaster.train_category_model(aggregated, category)

        return {
            "message": f"Model trained successfully for {category}",
            "category": category,
            "trained_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/predict/{category}")
async def predict_expenses(
    category: str,
    months: int = 3,
    current_user: dict = Depends(get_current_user)
):
    """Get expense predictions for the next N months."""
    try:
        forecaster = ExpenseForecaster()
        predictions = forecaster.predict_next_months(category, months)

        return {
            "category": category,
            "predictions": predictions,
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Model not found or error: {str(e)}")

@router.get("/categories")
async def get_trainable_categories(
    current_user: dict = Depends(get_current_user)
):
    """Get list of categories with enough data for training."""
    try:
        preparator = DataPreparator()
        df = preparator.get_historical_data(current_user['id'], months_back=12)

        # Count transactions per category
        category_counts = df.groupby('category').size()

        # Only return categories with at least 6 months of data
        sufficient_data = category_counts[category_counts >= 6].index.tolist()

        return {
            "categories": sufficient_data,
            "total": len(sufficient_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 5. Register Routes in Main App

In `backend/api/main.py`, add:

```python
from model.api.model_endpoints import router as forecast_router

app.include_router(forecast_router)
```

### 6. Frontend Integration

Add forecast visualization to the dashboard:

```typescript
// frontend/src/api.ts

export interface ForecastPrediction {
  date: string;
  predicted_amount: number;
  lower_bound: number;
  upper_bound: number;
}

export const trainForecast = async (category: string): Promise<void> => {
  await api.post(`/forecast/train/${category}`);
};

export const getForecast = async (
  category: string,
  months: number = 3
): Promise<ForecastPrediction[]> => {
  const { data } = await api.get(`/forecast/predict/${category}`, {
    params: { months }
  });
  return data.predictions;
};

export const getTrainableCategories = async (): Promise<string[]> => {
  const { data } = await api.get('/forecast/categories');
  return data.categories;
};
```

## Usage Examples

### Training a Model

```bash
curl -X POST "http://localhost:8000/api/forecast/train/Groceries" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Getting Predictions

```bash
curl "http://localhost:8000/api/forecast/predict/Groceries?months=3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response Example

```json
{
  "category": "Groceries",
  "predictions": [
    {
      "date": "2026-03",
      "predicted_amount": 450.23,
      "lower_bound": 380.15,
      "upper_bound": 520.31
    },
    {
      "date": "2026-04",
      "predicted_amount": 465.12,
      "lower_bound": 395.20,
      "upper_bound": 535.04
    },
    {
      "date": "2026-05",
      "predicted_amount": 442.89,
      "lower_bound": 372.77,
      "upper_bound": 513.01
    }
  ],
  "generated_at": "2026-02-07T14:30:00"
}
```

## Best Practices

1. **Data Requirements**: Ensure at least 6 months of historical data per category
2. **Retraining**: Retrain models monthly with new transaction data
3. **Validation**: Implement backtesting to validate model accuracy
4. **Error Handling**: Gracefully handle cases with insufficient data
5. **Caching**: Cache predictions for 24 hours to reduce computation
6. **Monitoring**: Track prediction accuracy and model performance

## Advanced Features

### Budget Optimizer

Create `model/forecasting/budget_optimizer.py` to suggest optimal budget allocations based on:
- Historical spending patterns
- Forecasted expenses
- User-defined financial goals
- Seasonality adjustments

### Anomaly Detection

Implement outlier detection to alert users about:
- Unusual spending spikes
- Missing expected transactions
- Potential fraud or errors

### Dashboard Integration

Add a "Forecast" section to the dashboard showing:
- Predicted vs actual spending charts
- Budget recommendations
- Spending trend analysis
- Confidence intervals for predictions

## Testing

Create tests in `tests/model/` for:
- Data preparation accuracy
- Model training pipeline
- Prediction accuracy
- API endpoint responses

## Deployment Considerations

- Store trained models in `model/models/` directory
- Add `model/models/*.pkl` to `.gitignore` (large files)
- Consider model versioning for tracking improvements
- Implement model retraining scheduler (e.g., monthly cron job)
- Monitor model drift and retrain when accuracy degrades

## Resources

- [Prophet Documentation](https://facebook.github.io/prophet/)
- [Scikit-learn User Guide](https://scikit-learn.org/stable/user_guide.html)
- [Time Series Forecasting with Python](https://machinelearningmastery.com/time-series-forecasting-python/)

## Future Enhancements

- Multi-step ahead forecasting (6-12 months)
- Ensemble models combining multiple algorithms
- Transfer learning across similar user profiles
- Real-time model updates with streaming data
- A/B testing for model improvements
