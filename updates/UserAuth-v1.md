# UserAuth Version 1

**Note:** This page is for an update to the authentication system, not to the site itself.  
**Note 2:** This page is meant for developer reference.

The UserAuth authentication system is the successor to the AuthData2 authentication system. It was released as part of the Account Update.

## Updates

- **Passwords**
  - Adds support for passwords
  - Passwords are now the primary authentication method
  - Passwords are not stored in plain text; they are salted and hashed
- **Two-Factor Authentication**
  - Adds defense against cookie-stealing, password-guessing, and brute-force attacks
  - **Note:** If someone were to get your password, 2FA would not fully prevent them from accessing your account; however, they would only be able to create a session and use functions that use `auth` + a session ID for authentication. They would be prevented from accessing the home page and most other pages, so any usage of the site would be very tedious.
- **Internal Security**
  - Unlike AuthData and AuthData2, UserAuth is composed of two separate interfaces- one which is good purely for authentication (UserAuth, hence the name), and one which is good purely for accessing user data (UserData). AuthData & AuthData2's single interface structure gave some functions unessescary access to a user's CDID or MPID.

## Usage

- **Functions**
  - All functions for UserAuth are located in the `auth.ts` file. They can be imported using

        import { functionName } from './auth'

  - For authentication, the only function you will need is `authUser`, as all authentication-related functions are nested in it.
  - All functions have inline documentation and type declarations, so you should just be able to autocomplete everything.
- **Authentication**
  - For authentication from a cookie string, the `authUser.fromCookie.bool` or `authUser.fromCookie.callback` functions should be good. The only difference between the two is the bool function returns a boolean and the callback function returns nothing but calls a given function on success and another one on failure.
  - To get the file containing all the authentication data, use `getUserAuths`. The object this returns is emails mapped to UserAuth objects. Each UserAuth object contains the user's name, salt, hash, and authorized device IDs.
