const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
//var search = require('youtube-search');
require('dotenv').config();
const YTK = require('yt-toolkit');
const Query = new YTK.Query(process.env.API_KEY);

/*
var opts = {
    maxResults: 1,
    key: process.env.API_KEY
};
*/
client.login(process.env.BOTTOKEN);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("reconnecting", () => {
    console.log("Reconnecting!");
});

client.on("disconnect", () => {
    console.log("Disconnect!");
});

const queue = new Map();
// Creating the contract for our queue

client.on('message', gotMessage);

function gotMessage(msg) {
    const serverQueue = queue.get(msg.guild.id);
    //console.log(msg.content);
    let text = msg.content.split(' ');
    if (text[0] === 'meoskip') {
        skip(msg, serverQueue);
    }
    if (text[0] === 'meostop') {
        stop(msg, serverQueue);
    }
    if (text[0] === 'meokeu') {
        if (text.length > 1) {
            execute(msg, serverQueue)
        }
    }
}

async function execute(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    Query.Search(message.content.slice(7, message.content.length), async (Results) => {
        console.log(Results[0].Video.ID);
 
        const songInfo = await ytdl.getInfo(Results[0].Video.ID);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
        };
        if (!serverQueue) {
            const queueContruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true
            };

            queue.set(message.guild.id, queueContruct);

            queueContruct.songs.push(song);
            try {
                var connection = await voiceChannel.join();
                queueContruct.connection = connection;
                var guild = message.guild;
                play(guild, queueContruct.songs[0]);
            } catch (err) {
                console.log(err);
                queue.delete(message.guild.id);
                return message.channel.send(err);
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} has been added to the queue!`);
        }
    });
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could stop!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}