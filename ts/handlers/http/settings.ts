import { reqHandlerFunction } from ".";
import ServerSettings from "../../modules/settings";

export const getSettings: reqHandlerFunction = (req, res) => {

    res.json(ServerSettings.getFor.full(req.userData.id))

}