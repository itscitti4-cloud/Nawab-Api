const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "Welcome to NAWAB API",
        author: "Shahryar Sabu"
    });
});

// একটি উদাহরণ ডেমো রিপ্লাই
app.get('/api/greet', (req, res) => {
    const name = req.query.name || "Guest";
    res.json({
        reply: `Hello ${name}, welcome to NAWAB API!`
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
