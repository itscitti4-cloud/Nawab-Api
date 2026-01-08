const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// Database Schema
const BabySchema = new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
});
const Baby = mongoose.model('babies', BabySchema);

// --- Gemini Official AI Response Function ---
async function getAIResponse(question) {
    try {
        const GEMINI_API_KEY = "AIzaSyCRSqp3e_s0BACEaUiLjWOLHRDFyx5tSjo"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `User question: "${question}". Answer this question in Romanized Bengali (Banglish) only. Examples: "Kemon acho?", "Ami bhalo achi", "Ki korcho?". Keep it short and friendly.`;

        const response = await axios.post(url, {
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

// 1. Chat Response
app.get('/api/bby', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.json({ error: "Please provide text!" });

    const results = await Baby.find({ ask: text.toLowerCase() });
    
    if (results.length > 0) {
        const randomAns = results[Math.floor(Math.random() * results.length)];
        res.json({ reply: randomAns.ans, source: "database" });
    } else {
        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "Gemini AI" });
    }
});

// 2. Teach (মাল্টি-টিচিং সাপোর্ট করে)
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Provide both 'ask' and 'ans'!" });

    try {
        const newData = new Baby({ 
            ask: ask.toLowerCase().trim(), 
            ans: ans.trim(), 
            teacher: teacher || "Unknown" 
        });
        await newData.save();
        res.json({ status: "success", message: "Teach successful!", data: { ask, ans, teacher } });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// 3. Remove (সুনির্দিষ্ট প্রশ্ন ও উত্তর রিমুভ করার জন্য আপডেট করা হয়েছে)
app.get('/api/bby/remove', async (req, res) => {
    const { ask, ans } = req.query;
    if (!ask || !ans) return res.json({ status: "failed", message: "Missing ask or ans" });

    try {
        const result = await Baby.deleteOne({ 
            ask: ask.toLowerCase().trim(), 
            ans: ans.trim() 
        });
        
        if (result.deletedCount > 0) {
            res.json({ status: "success", message: "Successfully removed!" });
        } else {
            res.json({ status: "failed", message: "No matching data found!" });
        }
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// 4. Total Entries
app.get('/api/bby/total', async (req, res) => {
    const count = await Baby.countDocuments();
    res.json({ total_commands: count });
});

// 5. List of Teachers
app.get('/api/bby/list', async (req, res) => {
    const list = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ teachers: list });
});

// 6. Top 10 Teachers
app.get('/api/bby/top', async (req, res) => {
    const top = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ top_10_teachers: top });
});

app.get('/', (req, res) => {
    res.json({ message: "Welcome to NAWAB-API with Multiple Teach & Remove Support" });
});

app.listen(PORT, () => console.log(`🚀 NAWAB-API is running on port ${PORT}`));
        
