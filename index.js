const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority&appName=Cluster0";

// কানেকশন অপশনসহ মঙ্গোডিবি কানেক্ট করুন
mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// --- Database Schemas & Models ---

// কালেকশন নেম সরাসরি সেট করা হয়েছে যাতে মঙ্গোডিবি নিজেই ফোল্ডার তৈরি করে
const babySchema = new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
});
const Baby = mongoose.model('babies', babySchema);

const unansweredSchema = new mongoose.Schema({
    question: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now }
});
// কালেকশনের নাম 'unanswered' হিসেবে ফিক্স করা হলো
const Unanswered = mongoose.model('unanswered', unansweredSchema, 'unanswered');

// --- Gemini AI Function ---
async function getAIResponse(question) {
    try {
        const GEMINI_API_KEY = "AIzaSyCRSqp3e_s0BACEaUiLjWOLHRDFyx5tSjo"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `User question: "${question}". Answer this question in Romanized Bengali (Banglish) only. Keep it short and friendly.`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

// ১. চ্যাট রেসপন্স এবং অটো-সেভ
app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim() : null;
    if (!text) return res.json({ error: "Please provide text!" });

    try {
        // ১. আগে মেইন ডাটাবেজে চেক করুন
        const result = await Baby.findOne({ ask: text });
        
        if (result) {
            return res.json({ reply: result.ans, source: "database" });
        } else {
            // ২. ডাটাবেজে না থাকলে Unanswered-এ সেভ করার চেষ্টা করুন
            // (ব্যবহার করা হয়েছে async/await এবং error handling)
            Unanswered.findOne({ question: text }).then(async (exist) => {
                if (!exist) {
                    const newEntry = new Unanswered({ question: text });
                    await newEntry.save();
                    console.log(`📌 Unanswered question saved: ${text}`);
                }
            }).catch(e => console.log("Save error:", e.message));

            // ৩. এআই থেকে উত্তর নিয়ে রিপ্লাই দিন
            const aiReply = await getAIResponse(text);
            return res.json({ reply: aiReply, source: "Gemini AI" });
        }
    } catch (dbError) {
        console.error("DB Error:", dbError);
        const aiReply = await getAIResponse(text);
        return res.json({ reply: aiReply, source: "AI (Error fallback)" });
    }
});

// ২. টিচ (Unanswered থেকে রিমুভ নিশ্চিত করা হয়েছে)
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Missing ask or ans" });

    try {
        const askText = ask.toLowerCase().trim();
        // মেইন ডাটাবেজে সেভ
        await Baby.create({ ask: askText, ans: ans.trim(), teacher: teacher || "Unknown" });
        // unanswered থেকে ডিলিট
        await Unanswered.deleteMany({ question: askText });
        
        res.json({ status: "success", message: "Teached and removed from unanswered" });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// ৩. প্রশ্ন ফেচ করার এন্ডপয়েন্ট
app.get('/api/bby/questions', async (req, res) => {
    const type = req.query.type;
    try {
        if (type === 'repeat') {
            const count = await Baby.countDocuments();
            if (count === 0) return res.json({ question: "Kemon acho?" });
            const random = Math.floor(Math.random() * count);
            const entry = await Baby.findOne().skip(random);
            res.json({ question: entry.ask });
        } else {
            const count = await Unanswered.countDocuments();
            if (count === 0) {
                // নতুন প্রশ্ন না থাকলে ডাটাবেজ থেকে র্যান্ডম দিবে
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
        res.json({ error: "Error fetching" });
    }
});

app.get('/', (req, res) => res.json({ status: "running" }));

app.listen(PORT, () => console.log(`🚀 NAWAB-API on port ${PORT}`));
