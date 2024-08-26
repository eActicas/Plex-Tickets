const mongoose = require('mongoose');

const schema = new mongoose.Schema ({
    msgID: String,
    userID: String,
    suggestion: String,
    upVotes: Number,
    downVotes: Number,
    status: String,
    voters: [
        {
          userID: String,
          voteType: String,
        },
      ],
});

module.exports = mongoose.model('suggestion', schema);