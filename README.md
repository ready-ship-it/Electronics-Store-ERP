# Electronics Store ERP - India Edition

Professional store management system for electronics retailers in India.

## Features

- **Role-Based Access Control**: Master Admin, Admin, and User roles
- **Product Management**: Add, edit, delete products with images, GST rates, stock tracking
- **Sales & Invoicing**: Create sales with automatic GST calculation, generate PDF invoices
- **Reports**: Daily, Monthly, Yearly sales reports with PDF export and print support
- **Automatic Backups**: Every 2 hours with cleanup (keep last 5), FTP upload support
- **Stock Management**: Low stock alerts, stock history tracking

## Default Login

- **Username**: `masteradmin`
- **Password**: `admin123`

## Local Setup

1. Install MySQL and create database
2. Copy `.env.example` to `.env` and configure
3. Run `npm install`
4. Run `npm start`

## Railway Deployment

1. Push to GitHub
2. Connect Railway to your repo
3. Add MySQL database service in Railway
4. Set environment variables in Railway dashboard
