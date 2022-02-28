# UserAuth Version 1

**Note:** This page is for an update to the authentication system, not to the site itself. 

**Note:** This page is meant for developer reference, hence the documentation.

The UserAuth authentication system is the successor to the AuthData2 authentication system. It was released as part of the Account Update.

## Updates

- **Passwords**
  - Adds support for passwords
  - Passwords are now the primary authentication method
- **Two-Factor Authentication**
  - Adds defense against cookie-stealing, password-guessing, and brute-force attacks
- **Internal Security**
  - More internal security

## Documentation

All functions for the UserAuth authentication system are located in `./auth.ts`. All interfaces (including interfaces for AuthData and AuthData2) are in `./lib/authdata.ts`.  

Most of these functions have inline documentation, so you should just be able to autofill everything.

- `getUserAuths() => UserAuths` Returns the userAuths json as a userAuths object
- `addUserAuth(email: string, name: string, pass: string) => void` Adds a user to the userAuths json.
- `authUser.bool(email: string, pass: string) => boolean | UserData` Authorizes a user and returns the result
- `authUser.callback(email: string, pass: string, success: (userData: userData) => any, failure: () => any) => void` Authorizes a user and expresses the result via callback functions
- `authUser.fromCookie.bool(cookieString: string) => boolean | UserData` Authorizes a user from a cookie string and returns a boolean
- `authUser.fromCookie.callback(cookieString: string, failure: () => any, success: (userData: UserData) => any) => void` Authorizes a user from a cookie string and expresses the result via a callback
- `authUser.deviceId(cookieString: string) => boolean` Checks whether a device is authorized
- `resetUserAuth(email: string) => void` Resets a user's auth
- `addDeviceId(email: string) => string` Creates a new authorized device id for a given user and returns it

## Usage Notes 

- Do not use any UserAuth functions for authorizing quick actions (sending a message, deleting a message, &c) as they are quite slow. Passwords have to be salted and hashed before they are checked which takes time. For quick actions, use a session id and the `auth` function instead. 
- `authUser.fromCookie.callback` is a direct replacement for `auth_cookiestring`.
- UserAuth authentication functions return a `UserData` object, as opposed to the `AuthData` and `AuthData2` objects returned by AuthData and AuthData2 functions. This object is essentially the exact same as the old one. It contains the user's name and email, but no authentication data. Authentication data is stored in `UserAuth` objects, but those not be used outside of `auth.ts` unless absolutely necessary. 
