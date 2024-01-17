let clipAPI = "http://localhost:8000";
let seriesAPI = "http://localhost:8001";

if (process.env.NODE_ENV === "production") {
  clipAPI = "https://clip-api.herokuapp.com";
  seriesAPI = "https://series-api.herokuapp.com";
}

export { clipAPI, seriesAPI };
