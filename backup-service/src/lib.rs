use json;
use std::fs;
use ftp::FtpStream;

/// Parses a json file, panics if parsing fails 
fn parse_json(file_name: &str) -> json::JsonValue {
    let contents = fs::read_to_string(file_name).unwrap();
    
    json::parse(&contents).unwrap()
}

pub struct Credentials {
    url: String,
    user: String,
    password: String
}

/// gets credentials from config.json
pub fn get_credentials() -> Credentials {
    if let json::JsonValue::Object(object) = parse_json("config.json") {
        Credentials {
            url: object.get("url").unwrap().to_string(),
            user: object.get("user").unwrap().to_string(),
            password: object.get("password").unwrap().to_string()
        }
    } else {
        panic!("config.json is not an object")
    }
}

impl Credentials {
    pub fn connect(&self) -> FtpStream {
        let mut stream = FtpStream::connect(&self.url).unwrap();
        println!("connect: Stream established");

        // Login
        stream.login(&self.user, &self.password).unwrap_or_else(|_| {
            panic!("connect: Invalid credentials") // custom error message for this one
        });
        println!("connect: Login success");

        stream
    }

    pub fn print(&self) {
        println!("url:      {}", &self.url);
        println!("user:     {}", &self.user);
        println!("password: {}", &self.password);
    }
}