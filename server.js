// Full content of server.js from commit 7db081909040057bb4565cd21c262e446d8509fa
// Assuming it contained the imports, initialization, routes, etc.

const express = require('express');
const axios = require('axios');
const app = express();

// Express middleware and setup
app.use(express.json());

// Bol.com API routes
app.get('/api/products', async (req, res) => {
    try {
        const response = await axios.get('https://api.bol.com/catalog/v4/products');
        res.json(response.data);
    } catch (error) {
        res.status(500).send('Error retrieving products');
    }
});

// AI functions (dummy example)
app.post('/api/ai/function', (req, res) => {
    const data = req.body;
    // Process data...
    res.send('AI function executed');
});

// Wildcard route for handling 404
app.use((req, res) => {
    res.status(404).send('Not found');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});