// let apiURL = "https://nljokeval-production.up.railway.app";
let apiURL = "http://localhost:8000";

if (process.env.NODE_ENV === "production") {
  apiURL = "https://nljokeval-production.up.railway.app";
}

export { apiURL };
