const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// --- Database Schemas ---

// মেইন চ্যাট ডাটাবেজ (যেখানে প্রশ্ন-উত্তর থাকে)
const BabySchema = new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
});
const Baby = mongoose.model('babies', BabySchema);

// উত্তরহীন প্রশ্নের ডাটাবেজ (Auto-Learning এর জন্য)
const UnansweredSchema = new mongoose.Schema({
    question: { type: String, required: true, lowercase: true, unique: true },
    addedAt: { type: Date, default: Date.now }
});
const Unanswered = mongoose.model('unanswered', UnansweredSchema);

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

        // যখনই AI উত্তর দিচ্ছে, তার মানে প্রশ্নটি ডাটাবেজে নেই। 
        // তাই প্রশ্নটি 'unanswered' কালেকশনে সেভ করছি যাতে !nt এ পাওয়া যায়।
        try {
            await Unanswered.findOneAndUpdate(
                { question: question.toLowerCase().trim() },
                { question: question.toLowerCase().trim() },
                { upsert: true }
            );
        } catch (e) { /* Ignore duplicate errors */ }

        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

// 1. Chat Response (Database + AI + Auto-Save Question)
app.get('/api/bby', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.json({ error: "Please provide text!" });

    const results = await Baby.find({ ask: text.toLowerCase().trim() });
    
    if (results.length > 0) {
        const randomAns = results[Math.floor(Math.random() * results.length)];
        res.json({ reply: randomAns.ans, source: "database" });
    } else {
        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "Gemini AI" });
    }
});

// 2. Teach (নতুন উঃ যোগ হলে unanswered থেকে ডিলিট হবে)
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

        // যেহেতু এখন উত্তর পাওয়া গেছে, তাই unanswered লিস্ট থেকে এই প্রশ্নটি সরিয়ে ফেলছি
        await Unanswered.deleteOne({ question: ask.toLowerCase().trim() });

        res.json({ status: "success", message: "Teach successful!" });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// 3. Remove
app.get('/api/bby/remove', async (req, res) => {
    const { ask, ans } = req.query;
    if (!ask || !ans) return res.json({ status: "failed", message: "Missing ask or ans" });

    try {
        const result = await Baby.deleteOne({ 
            ask: ask.toLowerCase().trim(), 
            ans: ans.trim() 
        });
        res.json(result.deletedCount > 0 ? { status: "success" } : { status: "failed" });
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

// 7. Get Questions (Support for !nt and !nt repeat)
app.get('/api/bby/questions', async (req, res) => {
    const type = req.query.type; // 'repeat' or 'new'
    
    try {
        if (type === 'repeat') {
            // Repeat মোড: মেইন ডাটাবেজ থেকে র্যান্ডম প্রশ্ন নিবে
            const count = await Baby.countDocuments();
            if (count === 0) return res.json({ question: "Database empty!" });
            const random = Math.floor(Math.random() * count);
            const entry = await Baby.findOne().skip(random);
            return res.json({ question: entry.ask });
        } else {
            // Normal মোড: Unanswered লিস্ট থেকে প্রশ্ন নিবে
            const count = await Unanswered.countDocuments();
            if (count === 0) {
                // যদি নতুন কোনো প্রশ্ন না থাকে, তবে মেইন ডাটাবেজ থেকে র্যান্ডম দিবে
                const bCount = await Baby.countDocuments();
                const bRandom = Math.floor(Math.random() * bCount);
                const bEntry = await Baby.findOne().skip(bRandom);
                return res.json({ question: bEntry ? bEntry.ask : "Kemon acho?" });
            }
            const random = Math.floor(Math.random() * count);
            const entry = await Unanswered.findOne().skip(random);
            res.json({ question: entry.question });
        }
    } catch (err) {
        res.json({ error: "Error fetching question" });
    }
});

app.get('/', (req, res) => {
    res.json({ message: "NAWAB-API Online: Auto-Learning Enabled" });
});

app.listen(PORT, () => console.log(`🚀 NAWAB-API is running on port ${PORT}`));
             
