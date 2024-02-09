let apiURL = "https://nljokeval-production.up.railway.app";

if (process.env.NODE_ENV === "production") {
  apiURL = "https://nljokeval-production.up.railway.app";
}

export { apiURL };
