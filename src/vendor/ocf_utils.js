/*let search_prefixes = {
  //not entirely sure whether waypoint search is case sensitive, doing this for safety.
  peachgate: "PeachGate",
  xavanadu: "Xavanadu",
  chelamela: "ChelaMela",
  jillscrossing: "JillsCrossing",
  e13th: "E13th",
  communityvillage: "CommunityVillage",
  upperriver: "UpperRiver",
  theritz: "TheRitz",
  mainstage: "MainStage",
  recyclingdock: "RecyclingDock",
  dragonmeadow: "DragonMeadow"
};*/

export function compareRooms(a, b) {
  let slugA = String(a.url);
  slugA = slugA.substring(slugA.lastIndexOf("/"), slugA.length);
  let slugB = String(b.url);
  slugB = slugB.substring(slugB.lastIndexOf("/"), slugB.length);
  let comparison = 0;
  if (slugA > slugB) {
    comparison = 1;
  } else if (slugA < slugB) {
    comparison = -1;
  }
  return comparison;
}

export async function getRoomsData() {
  // by https://twitter.com/jamesckane for @paracreative worked on the #ApartPosters show.
  //let endpoint = "/api/v1/media/search?source=rooms&filter=public";
  let endpoint = "https://hubs.ocfintheclouds.net/api/v1/media/search?source=rooms&filter=public";
  let response = await fetch(endpoint);
  let json = await response.json();

  let next_cursor = json.meta.next_cursor;
  while (next_cursor > 0) {
    let new_endpoint = endpoint + "&cursor=" + String(next_cursor);
    response = await fetch(new_endpoint);
    let next_json = await response.json();
    next_json.entries.forEach(room => {
      json.entries.push(room);
    });
    if (next_json.meta.next_cursor === undefined) next_cursor = 0;
    else next_cursor = next_json.meta.next_cursor;
  }
  return json;
}

export async function pickBestRoom(toSlug, search_prefix) {
  let rooms_data = await getRoomsData();
  let rooms = rooms_data.entries;
  let room_buffer = 5; //maybe? just to cover people currently on their way in.
  console.log("Total room data entries: " + String(rooms.length));
  let bestUrl = "";
  var copyRooms = rooms.filter(function(room) {
    return room.url.indexOf(toSlug) > 0;
  });
  console.log("Room entries for " + toSlug + ": " + String(copyRooms.length));
  if (copyRooms.length > 0) {
    copyRooms.sort(compareRooms);
    copyRooms.forEach(room => {
      console.log("sorted rooms: " + room.url);
      let memberCount = room.member_count;
      //let lobbyCount = room.lobby_count;
      if (memberCount < room.room_size - room_buffer && bestUrl.length == 0) {
        bestUrl = room.url + "?vr_entry_type=2d_now&waypoint_search_prefix=" + search_prefix;
      }
    });
  }
  return bestUrl;
}
