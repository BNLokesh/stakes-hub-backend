const express=require('express');
const app=express();
app.use(express.json());
const path=require('path')
const {open}=require('sqlite');
const sqlite3=require('sqlite3')

let db=null;
const dbPath=path.join(__dirname,"market.db")

const intialiazeDbAndServer=async()=>{
    try{
        db=await open({
        filename:dbPath,
        driver:sqlite3.Database
        })

        app.listen(3000,()=>{
            console.log("Sever Running")
        })
    }catch(e){
          console.log(`Error Message:${e.message}`)
          process.exit(1);
    }
}

app.post('/create-order', async (req, res) => {
    try {
        const { buyer_qty, buyer_price, seller_price, seller_qty } = req.body;

        await db.exec('BEGIN TRANSACTION');

        // Insert the new order into the PendingOrderTable
        const insertQuery = `
            INSERT INTO PendingOrderTable (buyer_qty, buyer_price, seller_price, seller_qty)
            VALUES (?, ?, ?, ?);
        `;
        await db.run(insertQuery, [buyer_qty, buyer_price, seller_price, seller_qty]);

        // Trigger matching logic
        const matchQuery = `
            SELECT * FROM PendingOrderTable 
            WHERE buyer_price >= seller_price 
            ORDER BY buyer_price DESC, seller_price ASC;
        `;
        const matchedOrders = await db.all(matchQuery);

        // Process matching orders
        for (let order of matchedOrders) {
            const { buyer_qty, buyer_price, seller_price, seller_qty, id } = order;
            const matchedQty = Math.min(buyer_qty, seller_qty);
            const matchedPrice = (buyer_price + seller_price) / 2; // Example price logic

            // Move the matched order to the CompletedOrderTable
            await db.run(`
                INSERT INTO CompletedOrderTable (price, qty)
                VALUES (?, ?);
            `, [matchedPrice, matchedQty]);

            // Update the PendingOrderTable based on the matched quantity
            if (buyer_qty > seller_qty) {
                await db.run(`
                    UPDATE PendingOrderTable
                    SET buyer_qty = buyer_qty - ?
                    WHERE id = ?;
                `, [matchedQty, id]);
            } else if (seller_qty > buyer_qty) {
                await db.run(`
                    UPDATE PendingOrderTable
                    SET seller_qty = seller_qty - ?
                    WHERE id = ?;
                `, [matchedQty, id]);
            } else {
                // If the quantities match exactly, delete the order from the PendingOrderTable
                await db.run(`DELETE FROM PendingOrderTable WHERE id = ?;`, [id]);
            }
        }

        await db.exec('COMMIT');
        res.status(201).send("Order created and matched successfully");
    } catch (error) {
        await db.exec('ROLLBACK');
        res.status(500).send({ error: `Failed to create and match order: ${error.message}` });
    }
});


app.post('/match-orders', async (req, res) => {
    try {
        await db.exec('BEGIN TRANSACTION');

        // Fetch matching orders (simple logic: buyer_price >= seller_price)
        const query = `
            SELECT * FROM PendingOrderTable 
            WHERE buyer_price >= seller_price 
            ORDER BY buyer_price DESC, seller_price ASC;
        `;
        const matchedOrders = await db.all(query);

        // Move matched orders to CompletedOrderTable and delete from PendingOrderTable
        for (let order of matchedOrders) {
            const { buyer_qty, buyer_price, seller_price, seller_qty, id } = order;
            const completed_qty = Math.min(buyer_qty, seller_qty);
            const completed_price = (buyer_price + seller_price) / 2; // Example price logic

            await db.run(`
                INSERT INTO CompletedOrderTable (price, qty)
                VALUES (?, ?);
            `, [completed_price, completed_qty]);

            // Update or delete pending orders based on matched quantities
            if (buyer_qty > seller_qty) {
                await db.run(`
                    UPDATE PendingOrderTable
                    SET buyer_qty = buyer_qty - ?
                    WHERE id = ?;
                `, [completed_qty, id]);
            } else if (seller_qty > buyer_qty) {
                await db.run(`
                    UPDATE PendingOrderTable
                    SET seller_qty = seller_qty - ?
                    WHERE id = ?;
                `, [completed_qty, id]);
            } else {
                await db.run(`DELETE FROM PendingOrderTable WHERE id = ?;`, [id]);
            }
        }

        await db.exec('COMMIT');
        res.status(200).send("Orders matched and moved to CompletedOrderTable");
    } catch (error) {
        await db.exec('ROLLBACK');
        res.status(500).send({ error: `Failed to match orders: ${error.message}` });
    }
});

app.get('/get-orders', async (req, res) => {
    try {
        const pendingOrders = await db.all('SELECT * FROM PendingOrderTable;');
        const completedOrders = await db.all('SELECT * FROM CompletedOrderTable;');

        res.status(200).send({
            pendingOrders,
            completedOrders
        });
    } catch (error) {
        res.status(500).send({ error: `Failed to get orders: ${error.message}` });
    }
});



intialiazeDbAndServer();