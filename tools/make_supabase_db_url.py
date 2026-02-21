from urllib.parse import quote


def main():
    print("Generate SUPABASE_DB_URL")
    project_ref = input("Project ref (e.g. abcdefghijklmnop): ").strip()
    db_password = input("DB password: ").strip()
    db_name = input("DB name [postgres]: ").strip() or "postgres"

    encoded_password = quote(db_password, safe="")
    url = f"postgresql://postgres:{encoded_password}@db.{project_ref}.supabase.co:5432/{db_name}?sslmode=require"

    print("\nUse this in Streamlit secrets:")
    print(f'SUPABASE_DB_URL = "{url}"')


if __name__ == "__main__":
    main()
