const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// --- MongoDB Connection ---
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 
})
.then(() => console.log("✅ NAWAB-API connected to MongoDB (Database: text)"))
.catch(err => console.error("❌ Database Connection Error:", err));

// --- Database Models ---
const Baby = mongoose.model('babies', new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
}));

const Unanswered = mongoose.model('unanswered', new mongoose.Schema({
    question: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now }
}), 'unanswered');

// --- 🟢 ১. Bby Chatbot Endpoints (আগেরগুলো ঠিক রাখা হয়েছে) ---

app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim().replace(/[^\w\s\u0980-\u09FF]/gi, '') : null;
    if (!text) return res.json({ error: "Please provide text!" });

    try {
        const result = await Baby.findOne({ ask: text });
        if (result) {
            return res.json({ reply: result.ans, source: "database" });
        } else {
            const exist = await Unanswered.findOne({ question: text });
            if (!exist) { await Unanswered.create({ question: text }); }
            return res.json({ reply: "Ei proshnotar uttor amar jana nei, ektu shikhiye dibe? (Use !teach command)", source: "unanswered_logger" });
        }
    } catch (err) {
        res.status(200).json({ reply: "Database ekhon ektu busy, abar try koro!", error: err.message });
    }
});

app.get('/api/bby/teach', async (req, res) => {
    let { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Ask and Ans required!" });
    try {
        const askText = ask.toLowerCase().trim().replace(/[^\w\s\u0980-\u09FF]/gi, '');
        await Baby.create({ ask: askText, ans: ans.trim(), teacher: teacher || "Unknown" });
        await Unanswered.deleteMany({ question: askText });
        res.json({ status: "success", message: "Shikhlam!" });
    } catch (err) { res.json({ status: "error", message: err.message }); }
});

app.get('/api/bby/remove', async (req, res) => {
    let { ask, ans } = req.query;
    if (!ask || !ans) return res.json({ status: "error", message: "Ask and Ans required!" });
    try {
        const askText = ask.toLowerCase().trim().replace(/[^\w\s\u0980-\u09FF]/gi, '');
        const deleted = await Baby.findOneAndDelete({ ask: askText, ans: ans.trim() });
        if (deleted) { res.json({ status: "success", message: "Deleted!" }); }
        else { res.json({ status: "error", message: "Not found!" }); }
    } catch (err) { res.json({ status: "error", message: err.message }); }
});

// --- 🔵 ২. WhatsApp DP Endpoint (নতুন যুক্ত করা হয়েছে) ---

app.get('/api/whatsapp', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.json({ error: "Number is required!" });

    try {
        // এখানে একটি শক্তিশালী সোর্স ব্যবহার করা হয়েছে
        const imgUrl = `https://wa-profile-pic.onrender.com/fetch?number=${number}`;
        res.json({ status: "success", result: imgUrl });
    } catch (err) {
        res.json({ status: "error", message: "Server busy" });
    }
});

// --- 🟡 ৩. Photo/Media Downloader Endpoint (নতুন যুক্ত করা হয়েছে) ---

app.get('/api/photo', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.json({ error: "URL is required!" });

    try {
        const response = await axios.get(`https://lianeapi.onrender.com/@nealiane/api/allinone?url=${encodeURIComponent(url)}`);
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "API is Down or URL invalid" });
    }
});

// --- অন্যান্য সেটিংস ---
app.get('/api/bby/list', async (req, res) => {
    try {
        const stats = await Baby.aggregate([{ $group: { _id: "$teacher", teach_count: { $sum: 1 } } }, { $project: { _id: 0, teacher_name: "$_id", teach_count: 1 } }, { $sort: { teach_count: -1 } }]);
        res.json({ teachers: stats });
    } catch (err) { res.json({ error: err.message }); }
});

app.get('/api/bby/total', async (req, res) => {
    try {
        const count = await Baby.countDocuments();
        res.json({ total_commands: count });
    } catch (err) { res.json({ error: err.message }); }
});

app.get('/', (req, res) => res.json({ status: "running", power: "Nawab API" }));
app.listen(PORT, () => console.log(`🚀 All-in-One API running on ${PORT}`));
