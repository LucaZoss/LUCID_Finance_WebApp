"""Create initial admin user for LUCID Finance."""

import getpass
from backend.data_pipeline.models import DatabaseManager, User
from backend.api.auth import get_password_hash


def create_admin_user():
    """Create the initial admin user."""
    print("=" * 60)
    print("Create Admin User for LUCID Finance")
    print("=" * 60)
    print()

    # Get admin credentials from user input
    admin_username = input("Enter admin username [luca]: ").strip() or "luca"
    admin_fullname = input("Enter full name [Luca Zosso]: ").strip() or "Luca Zosso"

    # Get password with confirmation
    while True:
        admin_password = getpass.getpass("Enter admin password: ")
        if len(admin_password) < 8:
            print("❌ Password must be at least 8 characters long")
            continue

        password_confirm = getpass.getpass("Confirm password: ")
        if admin_password == password_confirm:
            break
        print("❌ Passwords don't match. Try again.")

    print()

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

        print("=" * 60)
        print("✅ Admin user created successfully!")
        print("=" * 60)
        print()
        print(f"  Username:  {admin_username}")
        print(f"  Full Name: {admin_fullname}")
        print("  Role:      Admin")
        print()
        print("You can now:")
        print("  1. Start the backend: ./start_backend.sh")
        print("  2. Start the frontend: ./start_frontend.sh")
        print("  3. Login at: http://localhost:5173")
        print("  4. Create additional users from the admin panel")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Error creating admin user: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    create_admin_user()
