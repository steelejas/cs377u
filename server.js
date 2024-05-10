/*
USAGE NOTES 

LOGGING IN: Jasmine’s credentials work here for any user to login, just make sure…
  1) User is added to user list (see https://developer.spotify.com/dashboard/27355b6bf834496e8d4a0ebee545f18c/users, use Jasmine’s login)

  2) Session is brand new (Spotify does some weird cache thing)

  3) User has made some Spotify app in the past (so they have some existing Spotify secret & id... yeah, a HUGE pain, I know...)

APP WON'T START
  1) Assuming you've already tried starting a fresh new session...

  2) Try npm install & npm start again... That should do the trick...
*/

import express from "express";
import fetch from "node-fetch";

const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));

// Jasmine's credientials below! Should NOT have to change them!
const redirect_uri = "http://localhost:3000/callback";
const client_id = "27355b6bf834496e8d4a0ebee545f18c";
const client_secret = "a9b83d2bf5b94583a470ec3e52612dae";
global.access_token;

app.get("/", function (req, res) {
  console.log('HEY! Login page loaded!')
  res.render("index");
});

app.get("/authorize", (req, res) => {
  console.log('HEY! Login button clicked!')
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: "user-library-read user-top-read user-read-recently-played playlist-modify-public playlist-modify-private",
    redirect_uri: redirect_uri,
    show_dialog: true
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  console.log('HEY! LOGGING IN...')

  var body = new URLSearchParams({
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    body: body,
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
  });

  const data = await response.json();
  global.access_token = data.access_token;

  res.redirect("/dashboard");
});

async function getData(endpoint) {
  console.log('HEY! Fetching user data...')
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "get",
    headers: {
      Authorization: "Bearer " + global.access_token,
    },
  });

  const data = await response.json();
  return data;
}

app.get("/dashboard", async (req, res) => {
  const userInfo = await getData("/me");
  const tracks = await getData("/me/tracks?limit=10");
  const playlists = await getData("/me/playlists");

  res.render("dashboard", { user: userInfo, tracks: tracks.items, playlists: playlists.items });
});

app.get("/recommendations", async (req, res) => {
  const artist_id = req.query.artist;
  const track_id = req.query.track;

  const params = new URLSearchParams({
    seed_artist: artist_id,
    seed_genres: "rock",
    seed_tracks: track_id,
  });

  const data = await getData("/recommendations?" + params);
  res.render("recommendation", { tracks: data.tracks });
});

app.get("/playlist", async (req, res) => {
  const playlist_id = req.query.id;
  const playlist = await getData("/playlists/" + playlist_id);
  res.render("playlist", { playlist: playlist });
});


app.get("/remix", async (req, res) => {
  const playlist_id = req.query.id;
  const playlist = await getData("/playlists/" + playlist_id);

  const lib = await getData("/me/tracks");
  console.log(lib.total);

  // const recent1 = await getData("/me/player/recently-played");
  // console.log(recent.total);

  const time_range = "long_term";
  const limit = 50;
  const topTotalCheck = await getData("/me/top/tracks");
  let offset = topTotalCheck.total - limit;
  let lowestInPlaylist = [];
  while (lowestInPlaylist.length < 10 && offset > 0) {
    let lowest = await getData("/me/top/tracks?time_range=" + time_range + "&limit=" + limit + "&offset=" + offset);
    for (let i = 0; i < lowest.items.length; i++) {
      for (let j = 0; j < playlist.tracks.items.length; j++) {
        if (lowest.items[i].id == playlist.tracks.items[j].track.id) {
          lowestInPlaylist.push(lowest.items[i]);
        }
      }
    }
    offset -= limit; // shift offset backwards for the next check
    /*
    if (offset < 0) {
      offset = 0;
      let lowest = await getData("/me/top/tracks?time_range=" + time_range + "&limit=" + limit + "&offset=" + offset);
      lowest.items.forEach(lowestTrack => {
        playlist.tracks.items.forEach(playlistTrack => {
          if (lowestTrack.id == playlistTrack.id) {
            lowestInPlaylist.push(lowestTrack);
          }
        });
      });
    }
    */
  }

  res.render("remix", { playlist: playlist, lowest: lowestInPlaylist });
});

app.get("/library", async (req, res) => {
  console.log("LOADING LIBRARY")

  // Loading page first
  res.render("loading");
  
  const lib = await getData("/me/tracks");
  console.log(lib.total);

  const time_range = "long_term";
  const limit = 50;
  const topTotalCheck = await getData("/me/top/tracks");
  let offset = topTotalCheck.total - limit;
  let lowestInLib = [];
  while (lowestInLib.length < 10 && offset > 0) {
    let lowest = await getData("/me/top/tracks?time_range=" + time_range + "&limit=" + limit + "&offset=" + offset);
    for (let i = 0; i < lowest.items.length; i++) {
      for (let j = 0; j < lib.items.length; j++) {
        if (lowest.items[i].id == lib.items[j].track.id) {
          lowestInLib.push(lowest.items[i]);
        }
      }
    }
    offset -= limit; // shift offset backwards for the next check
    /*
    if (offset < 0) {
      offset = 0;
      let lowest = await getData("/me/top/tracks?time_range=" + time_range + "&limit=" + limit + "&offset=" + offset);
      lowest.items.forEach(lowestTrack => {
        playlist.tracks.items.forEach(playlistTrack => {
          if (lowestTrack.id == playlistTrack.id) {
            lowestInPlaylist.push(lowestTrack);
          }
        });
      });
    }
    */
  }

  res.render("library", { lowest: lowestInLib });
});

app.get("/createplaylist", async (req, res) => {
  const userInfo = await getData("/me");
  
  var body = new URLSearchParams({
    name: "New Playlist",
    description: "New playlist description",
    public: false
  });

  const response = await fetch("https://api.spotify.com/v1/users/" + userInfo.id + "/playlists", {
    method: "post",
    body: body,
    /*body: {
      "name": "New Playlist",
      "description": "New playlist description",
      "public": "false"
    },*/
    headers: {
      "Content-type": "application/json",
      Authorization: "Bearer " + global.access_token,
    },
  });

  /*
  curl --request POST \
  --url https://api.spotify.com/v1/users/smedjan/playlists \
  --header 'Authorization: Bearer 1POdFZRZbvb...qqillRxMr2z' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "New Playlist",
    "description": "New playlist description",
    "public": false
}'
  */

  const data = await response.json();
  res.render("createplaylist", { playlist: data });
});

/*
app.get("/remix", async (req, res) => {
  const playlist_id = req.query.id;
  const playlist = await getData("/playlists/" + playlist_id);


  const lib = await getData("/me/tracks");
  console.log(lib.total);

  // const recent1 = await getData("/me/player/recently-played");
  // console.log(recent.total);

  const time_range = "long_term";
  const limit = 50;
  const topTotalCheck = await getData("/me/top/tracks");
  let offset = topTotalCheck.total - limit;
  const lowest = await getData("/me/top/tracks?time_range=" + time_range + "&limit=" + limit + "&offset=" + offset);
  res.render("remix", { playlist: playlist, lowest: lowest.items });
});
*/

let listener = app.listen(3000, function () {
  console.log(
    "Your app is listening on http://localhost:" + listener.address().port
  );
});