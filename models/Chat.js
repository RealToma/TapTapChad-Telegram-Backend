const mongoose = require("mongoose");
const random = require('mongoose-simple-random');
const Schema = mongoose.Schema;

// this will be our data base's data structure
const schema = new Schema(
    {
        chatId: {
            type: Number,
            require: true,
            default: () => '',
        },
    },
    { versionKey: false, timestamps: true },
);
schema.plugin(random);

// export the new Schema so we could modify it using Node.js
module.exports = mongoose.model("chats", schema);