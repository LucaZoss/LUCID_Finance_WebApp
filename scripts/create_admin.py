"""Create initial admin user for LUCID Finance."""

from backend.data_pipeline.models import DatabaseManager, User
from backend.api.auth import get_password_hash


def create_admin_user():
    """Create the initial admin user."""
    # Admin credentials
    admin_username = "luca"
    admin_password = "lucid-admin$"
    admin_fullname = "Luca Zosso"

    db_manager = DatabaseManager()

    # Create tables if they don't exist
    print("Creating database tables...")
    db_manager.create_tables()

    session = db_manager.get_session()
    try:
        # Check if admin already exists
        existing_admin = session.query(User).filter(User.username == admin_username).first()

        if existing_admin:
            print(f"❌ Admin user '{admin_username}' already exists!")
            print("   Use the frontend to create additional users.")
            return

        # Create admin user
        admin_user = User(
            username=admin_username,
            hashed_password=get_password_hash(admin_password),
            full_name=admin_fullname,
            is_admin=True,
            is_active=True
        )

        session.add(admin_user)
        session.commit()

        print("✅ Admin user created successfully!")
        print()
        print("=" * 60)
        print("  Login Credentials")
        print("=" * 60)
        print(f"  Username: {admin_username}")
        print(f"  Password: {admin_password}")
        print("=" * 60)
        print()
        print("⚠️  IMPORTANT: Change the password immediately after first login!")
        print()
        print("You can now:")
        print("  1. Start the backend: ./start_backend.sh")
        print("  2. Start the frontend: ./start_frontend.sh")
        print("  3. Login at: http://localhost:5173")
        print("  4. Create additional users from the admin panel")

    except Exception as e:
        session.rollback()
        print(f"❌ Error creating admin user: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    create_admin_user()
