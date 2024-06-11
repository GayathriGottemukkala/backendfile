const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path=require("path")
const app = express();
const dbPath = path.join(__dirname,"bdbase.bd");
let bd;

const initializeDatabase = async () => {
    try{
        bd=await open({filename:dbPath,driver:sqlite3.Database})
        app.listen(3001,()=>{
            console.log("checked")
        })
        const response = await axios.get("https://s3.amazonaws.com/roxiler.com/product_transaction.json");
        const data = response.data;
        await bd.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                title TEXT,
                description TEXT,
                price REAL,
                category TEXT,
                dateOfSale TEXT,
                sold INTEGER
            )
        `);
        const insertStatement = await bd.prepare(`
            INSERT INTO products (title, description, price, category, dateOfSale, sold)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const product of data) {
            await insertStatement.run(
                product.title,
                product.description,
                product.price,
                product.category,
                product.dateOfSale,
                product.sold
            );
        }

        await insertStatement.finalize();

        console.log("Database initialized with seed data");
    
    }catch(e){
        console.log(`DB error: ${e.message}`)
    }
}

        
// Initialize the database
initializeDatabase();

// API to list all transactions
app.get("/api/transactions", async (req, res) => {
    try {
        const { month, search = '', page = 1, per_page = 10 } = req.query;
        
        

        // Query to fetch transactions based on month, search, pagination
        const transactions = await bd.all(`
            SELECT * FROM products
            WHERE strftime('%m', dateOfSale) = ? AND (
                title LIKE '%' || ? || '%' OR
                description LIKE '%' || ? || '%' OR
                price LIKE '%' || ? || '%'
            )
            LIMIT ? OFFSET ?
        `, [month, search, search, search, per_page, (page - 1) * per_page]);

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API for statistics
app.get("/api/statistics", async (req, res) => {
    try {
        const { month } = req.query;

       

        // Total sale amount of selected month
        const totalSaleAmount = await bd.get(`
            SELECT SUM(price) AS totalSaleAmount FROM products
            WHERE strftime('%m', dateOfSale) = ?
        `, [month]);

        // Total number of sold items of selected month
        const totalSoldItems = await bd.get(`
            SELECT COUNT(*) AS totalSoldItems FROM products
            WHERE strftime('%m', dateOfSale) = ?
        `, [month]);

        // Total number of not sold items of selected month
        const totalNotSoldItems = await bd.get(`
            SELECT COUNT(*) AS totalNotSoldItems FROM products
            WHERE strftime('%m', dateOfSale) = ? AND sold = 0
        `, [month]);

        res.json({
            totalSaleAmount: totalSaleAmount.totalSaleAmount || 0,
            totalSoldItems: totalSoldItems.totalSoldItems || 0,
            totalNotSoldItems: totalNotSoldItems.totalNotSoldItems || 0
        });
    } catch (error) {
        console.error("Error fetching statistics:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API for bar chart
app.get("/api/bar-chart", async (req, res) => {
    try {
        const { month } = req.query;

       

        // Query to fetch price range and number of items in each range
        const barChartData = await bd.all(`
            SELECT 
                CASE
                    WHEN price BETWEEN 0 AND 100 THEN '0 - 100'
                    WHEN price BETWEEN 101 AND 200 THEN '101 - 200'
                    WHEN price BETWEEN 201 AND 300 THEN '201 - 300'
                    WHEN price BETWEEN 301 AND 400 THEN '301 - 400'
                    WHEN price BETWEEN 401 AND 500 THEN '401 - 500'
                    WHEN price BETWEEN 501 AND 600 THEN '501 - 600'
                    WHEN price BETWEEN 601 AND 700 THEN '601 - 700'
                    WHEN price BETWEEN 701 AND 800 THEN '701 - 800'
                    WHEN price BETWEEN 801 AND 900 THEN '801 - 900'
                    ELSE '901-above'
                END AS priceRange,
                COUNT(*) AS itemCount
            FROM products
            WHERE strftime('%m', dateOfSale) = ?
            GROUP BY priceRange
        `, [month]);

        res.json(barChartData);
    } catch (error) {
        console.error("Error fetching bar chart data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API
