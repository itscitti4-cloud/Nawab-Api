const express = require('express');
const mongoose = require('mongoose');
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

// --- API Endpoints ---

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

// --- ✅ নতুন যোগ করা হয়েছে: Remove Endpoint ---
app.get('/api/bby/remove', async (req, res) => {
    let { ask, ans } = req.query;
    if (!ask || !ans) return res.json({ status: "error", message: "Ask and Ans required!" });
    try {
        const askText = ask.toLowerCase().trim().replace(/[^\w\s\u0980-\u09FF]/gi, '');
        const deleted = await Baby.findOneAndDelete({ ask: askText, ans: ans.trim() });
        
        if (deleted) {
            res.json({ status: "success", message: "Deleted from database!" });
        } else {
            res.json({ status: "error", message: "Data not found!" });
        }
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// --- List/Top/Total Endpoints ---

app.get('/api/bby/list', async (req, res) => {
    try {
        const stats = await Baby.aggregate([
            { $group: { _id: "$teacher", teach_count: { $sum: 1 } } },
            { $project: { _id: 0, teacher_name: "$_id", teach_count: 1 } },
            { $sort: { teach_count: -1 } }
        ]);
        res.json({ teachers: stats });
    } catch (err) { res.json({ error: err.message }); }
});

app.get('/api/bby/top', async (req, res) => {
    try {
        const top = await Baby.aggregate([
            { $group: { _id: "$teacher", teach_count: { $sum: 1 } } },
            { $sort: { teach_count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, teacher_name: "$_id", teach_count: 1 } }
        ]);
        res.json({ top_10_teachers: top });
    } catch (err) { res.json({ error: err.message }); }
});

app.get('/api/bby/total', async (req, res) => {
    try {
        const count = await Baby.countDocuments();
        res.json({ total_commands: count });
    } catch (err) { res.json({ error: err.message }); }
});

// --- Questions Endpoint ---
app.get('/api/bby/questions', async (req, res) => {
    try {
        const count = await Unanswered.countDocuments();
        if (count === 0) {
            const bCount = await Baby.countDocuments();
            if (bCount === 0) return res.json({ question: "Kemon acho?" });
            const random = Math.floor(Math.random() * bCount);
            const entry = await Baby.findOne().skip(random);
            return res.json({ question: entry ? entry.ask : "Kemon acho?" });
        }
        const random = Math.floor(Math.random() * count);
        const entry = await Unanswered.findOne().skip(random);
        res.json({ question: entry.question });
    } catch (err) { res.json({ error: "Error" }); }
});

app.get('/', (req, res) => res.json({ status: "running" }));
app.listen(PORT, () => console.log(`🚀 API running on ${PORT}`));
            
