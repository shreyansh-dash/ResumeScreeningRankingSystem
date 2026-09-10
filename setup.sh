#!/bin/bash

echo "Setting up Resume Screening System - Step 1"
echo "=========================================="

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Setting up MySQL database..."
echo "Please run the following SQL commands in MySQL Workbench:"
echo "1. Open database_schema.sql"
echo "2. Execute all queries to create the schema"
echo ""
echo "Then update the password in import_data.py:"
echo "Change 'your_mysql_password' to your actual MySQL password"

echo ""
echo "Setup complete!"
echo "Next steps:"
echo "1. Run: mysql -u root -p < database_schema.sql"
echo "2. Update password in import_data.py"
echo "3. Run: python import_data.py"
