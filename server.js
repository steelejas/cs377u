import express from "express";
import fetch from "node-fetch";

const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));

const redirect_uri = "http://localhost:3000/callback";
const client_id = "27355b6bf834496e8d4a0ebee545f18c";
const client_secret = "a9b83d2bf5b94583a470ec3e52612dae";

global.access_token;

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/authorize", (req, res) => {
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: "user-library-read user-top-read user-read-recently-played",
    redirect_uri: redirect_uri,
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

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
  const playlists = await getData("/me/playlists"); // mine


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