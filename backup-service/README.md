# backup-service

Connects to an FTP server and downloads all the files in a given directory. Used to create off-site backups for Backup Google Chat.

## To Use

1. Compile to binary:

       cargo build --release

2. Locate binary (`target > release > backup-service.exe`)

3. Place binary in the same directory as a valid `config.json` file

4. Run binary

## `config.json` Format

**Note:** All fields are required

```json
{
    "url": "ftp.example.com:21", // string, FTP url (with port, usually 21)
    "user": "user", // string, username
    "password": "password", // string, password
    "out": "C:\\example\\dir", // string, local directory to store downloaded files in
    "in": "example/dir", // string, external directory to download
    "threads": 10 // number, number of threads to use while downloading files, more threads = faster download but more resource usage
}
```
