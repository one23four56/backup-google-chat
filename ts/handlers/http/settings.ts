import { reqHandlerFunction } from ".";
import ServerSettings from "../../modules/settings";
import authUser from "../../modules/userAuth";

export const getSettings: reqHandlerFunction = (req, res) => {

    const userData = authUser.full(req.headers.cookie);
    if (!userData)
        return res.sendStatus(401)

    res.json(ServerSettings.getFor.full(userData.id))

}