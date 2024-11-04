import { Response } from "express";
import { type reqHandlerFunction } from ".";
import { UserBots } from "../../modules/userBots";

function errorSender(res: Response) {
    return (reason: string, status: number = 400) => {
        res.status(status).type("text/plain")
            .send(reason);
    }
}

export const create: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (UserBots.getByAuthor(req.userData.id).length >= 10)
        return error(`You can't create more than 10 bots`);

    const id = UserBots.create(req.userData.id);

    res.type("text/plain").send(id);
}

export const get: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error(`Invalid bot ID`);

    const bot = UserBots.get(req.params.id);

    if (!bot || bot.author !== req.userData.id)
        return error(`Bot does not exist`);

    res.json(bot);
}

export const getAll: reqHandlerFunction = (req, res) => {
    res.json(UserBots.getByAuthor(req.userData.id));
}

export const setName: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.body.name !== "string")
        return error("Name must be a string");

    if (typeof req.params.id !== "string")
        return error("Invalid bot ID");

    const bot = UserBots.get(req.params.id);

    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = UserBots.setName(bot.id, req.body.name);

    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const setImage: reqHandlerFunction = async (req, res) => {
    const error = errorSender(res);

    if (typeof req.body.image !== "string")
        return error("Image URL must be a string");

    if (typeof req.params.id !== "string")
        return error("Invalid bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = await UserBots.setImage(bot.id, req.body.image);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const setDescription: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.body.description !== "string")
        return error("Description must be a string");

    if (typeof req.params.id !== "string")
        return error("Invalid bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = UserBots.setDescription(bot.id, req.body.description);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const getToken: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const token = UserBots.generateToken(bot.id);

    res.type("text/plain").send(token);
}

export const enable: reqHandlerFunction = async (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const publish = await UserBots.enable(req.params.id);
    if (!publish[0])
        return error(publish[1]);

    res.sendStatus(200);
}

export const setCommandServer: reqHandlerFunction = async (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    if (typeof req.body.server !== "string")
        return error("Server URL must be a string");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const set = await UserBots.setCommandServer(req.params.id, req.body.server);
    if (!set[0])
        return error(set[1]);

    res.sendStatus(200);
}

export const setCommands: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    if (!UserBots.isCommands(req.body))
        return error("Invalid Request Body");

    const result = UserBots.setCommands(req.params.id, req.body);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const setEvent: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    if (typeof req.body.event !== "string")
        return error("Event must be a string");

    if (typeof req.body.enabled !== "boolean")
        return error("Enabled must be a boolean");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = UserBots.setEvent(bot.id, req.body.event, req.body.enabled);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const publishBot: reqHandlerFunction = async (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = await UserBots.publish(req.params.id);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const disableBot: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = UserBots.disable(req.params.id);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}

export const deleteBot: reqHandlerFunction = (req, res) => {
    const error = errorSender(res);

    if (typeof req.params.id !== "string")
        return error("Invalid Bot ID");

    const bot = UserBots.get(req.params.id);
    if (!bot || bot.author !== req.userData.id)
        return error("Bot does not exist");

    const result = UserBots.delete(req.params.id);
    if (!result[0])
        return error(result[1]);

    res.sendStatus(200);
}