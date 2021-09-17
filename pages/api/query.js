// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import database_utils from "../../utils/database_utils";

export default function handler(req, res) {
  const id = req.body?.id;
  const database = req.body?.database;
  if (!id || !database) {
    return res.status(400).send();
  }
  try {
    const match_info = database_utils.query(database, id);
    return res.status(200).json(match_info);
  }
  catch (error) {
    if (error.name === "JSNetworkXError") {
      return res.status(404).json({"error" : error.message});
    }
  }


}
