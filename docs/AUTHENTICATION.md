# Authentication System

LUCID Finance now includes user authentication and access control.

## Features

- **Login System**: JWT-based authentication with secure token storage
- **User Management**: Admin can create and manage user accounts
- **Role-Based Access**: Admin vs regular user roles
- **Protected Routes**: All app features require authentication
- **Session Persistence**: Auto-login on browser refresh

---

## Initial Setup

### 1. Create Admin User

```bash
uv run python create_admin.py
```

**Admin Credentials:**
- Username: `luca`
- Password: `lucid-admin$`

---

## Using the System

### Login
1. Start backend: `./start_backend.sh`
2. Start frontend: `./start_frontend.sh`
3. Open: `http://localhost:5173`
4. Login:
   - Username: `luca`
   - Password: `lucid-admin$`

### Create New Users (Admin Only)

**to get bearer token**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "luca", "password": "lucid-admin$"}'
```

**Via API:**
```bash
curl -X POST http://localhost:8000/api/auth/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "secure_password",
    "full_name": "John Doe",
    "is_admin": false
  }'
```

**Via Frontend:**
*Coming soon: User management page*

### List Users
```bash
curl http://localhost:8000/api/auth/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---
# Get token and save it
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "luca", "password": "lucid-admin$"}' \
  | grep -o '"access_token":"[^"]*"' \
  | cut -d'"' -f4)

# Use the token to check users
curl http://localhost:8000/api/auth/users \
  -H "Authorization: Bearer $TOKEN"



---

## API Endpoints

### Public Endpoints
- `POST /api/auth/login` - Login and get JWT token

### Protected Endpoints
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/users` - List all users (admin only)
- `POST /api/auth/users` - Create new user (admin only)
- All existing endpoints (`/api/transactions`, `/api/budgets`, etc.)

---

## Token Management

**Token Storage:**
- Frontend stores JWT in `localStorage`
- Token automatically included in all API requests
- Token expires after 24 hours

**Token Format:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## User Roles

### Admin
- Full access to all features
- Can create/manage users
- Badge shown in UI

### Regular User
- Access to all budgeting features
- Cannot create users
- Cannot access admin endpoints

---

## Security Notes

### Change Default Password
```bash
# After first login, admin should change password
# (Password change UI coming soon)
```

### Secret Key
The JWT secret key is currently hardcoded in `src/api/auth.py`:
```python
SECRET_KEY = "your-secret-key-change-this-in-production-use-env-variable"
```

**For Production:**
1. Generate a secure random key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. Add to `.env`:
   ```bash
   JWT_SECRET_KEY=your_generated_key_here
   ```

3. Update `src/api/auth.py` to read from environment:
   ```python
   import os
   SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-key")
   ```

### Password Requirements
- Minimum 5 characters (default)
- Hashed with bcrypt
- Never stored in plain text

---

## Files Modified

### Backend
- `src/data_pipeline/models.py` - Added User model
- `src/api/auth.py` - Authentication utilities
- `src/api/main.py` - Auth endpoints + protected routes

### Frontend
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/pages/LoginPage.tsx` - Login UI
- `frontend/src/App.tsx` - Protected routes wrapper
- `frontend/src/api.ts` - Auth API calls

### Scripts
- `create_admin.py` - Initialize admin user

---

## Troubleshooting

### Can't login
- Check backend is running: `http://localhost:8000/api/health`
- Verify admin user exists: Check database users table
- Check browser console for errors

### Token expired
- Logout and login again
- Token expires after 24 hours

### Forgot password
- Currently no password reset
- Admin must recreate user or update database directly:
  ```sql
  -- Reset admin password in MySQL
  docker exec -it lucid_finance_db mysql -ulucid_user -p
  USE lucid_finance;
  UPDATE users SET hashed_password = '$2b$12$...' WHERE username = 'admin';
  ```

---

## Future Enhancements

- [ ] Password change UI
- [ ] User management page (admin)
- [ ] Password reset functionality
- [ ] Email verification
- [ ] Remember me option
- [ ] Session timeout warning
- [ ] Activity logging

---

## Testing

```bash
# Test login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "luca", "password": "lucid-admin$"}'

# Test protected endpoint
TOKEN="your_token_here"
curl http://localhost:8000/api/transactions \
  -H "Authorization: Bearer $TOKEN"
```

---

**Authentication is now fully integrated!** All users must login to access the application.
