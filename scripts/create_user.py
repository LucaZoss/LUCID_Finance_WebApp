"""Create a new user for LUCID Finance."""

import getpass
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.data_pipeline.models import DatabaseManager, User
from backend.api.auth import get_password_hash


def create_user():
    """Create a new user with specified role."""
    print("=" * 60)
    print("Create New User for LUCID Finance")
    print("=" * 60)
    print()

    # Get user credentials from user input
    username = input("Enter username: ").strip()
    if not username:
        print("❌ Username cannot be empty")
        sys.exit(1)

    fullname = input("Enter full name: ").strip()
    if not fullname:
        print("❌ Full name cannot be empty")
        sys.exit(1)

    # Ask if user should be admin
    is_admin_input = input("Should this user be an admin? (y/N): ").strip().lower()
    is_admin = is_admin_input == 'y' or is_admin_input == 'yes'

    # Get password with confirmation
    while True:
        password = getpass.getpass("Enter password: ")
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long")
            continue

        password_confirm = getpass.getpass("Confirm password: ")
        if password == password_confirm:
            break
        print("❌ Passwords don't match. Try again.")

    print()

    db_manager = DatabaseManager()
    session = db_manager.get_session()

    try:
        # Check if user already exists
        existing_user = session.query(User).filter(User.username == username).first()

        if existing_user:
            print(f"❌ User '{username}' already exists!")
            print("   Choose a different username.")
            sys.exit(1)

        # Create new user
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            full_name=fullname,
            is_admin=is_admin,
            is_active=True
        )

        session.add(new_user)
        session.commit()

        print("=" * 60)
        print("✅ User created successfully!")
        print("=" * 60)
        print()
        print(f"  Username:  {username}")
        print(f"  Full Name: {fullname}")
        print(f"  Role:      {'Admin' if is_admin else 'Regular User'}")
        print(f"  Status:    Active")
        print()
        print(f"The user can now login at: https://lucid-finance.cc")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Error creating user: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    create_user()
