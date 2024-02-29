use chrono;
use ftp::FtpStream;
use json;
use std::{fmt::Debug, fs, ops::Index};

/// Parses a json file, panics if parsing fails
fn parse_json(file_name: &str) -> json::JsonValue {
    let contents = fs::read_to_string(file_name).unwrap();

    json::parse(&contents).unwrap()
}

pub struct Credentials {
    url: String,
    user: String,
    password: String,
    pub out: String,
}

/// gets credentials from config.json
pub fn get_credentials() -> Credentials {
    if let json::JsonValue::Object(object) = parse_json("config.json") {
        Credentials {
            url: object.get("url").unwrap().to_string(),
            user: object.get("user").unwrap().to_string(),
            password: object.get("password").unwrap().to_string(),
            out: object.get("out").unwrap().to_string(),
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
        stream
            .login(&self.user, &self.password)
            .unwrap_or_else(|_| {
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

pub enum ItemType {
    File,
    Dir,
}

impl Debug for ItemType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ItemType::File => f.write_str("FILE"),
            ItemType::Dir => f.write_str("DIR"),
        }
    }
}

type FileData = (String, ItemType);

struct Storage {
    path: String,
}

impl Storage {
    pub fn new(out: &String) -> Storage {
        let date_time = chrono::offset::Local::now().format("%Y-%m-%d_%H-%M");

        let path = format!("{}/osb-{}", out, date_time);
        fs::create_dir(&path).expect("Failed to create dir");

        Storage { path }
    }

    pub fn write(&self, file: String, contents: Vec<u8>) {
        fs::write(format!("{}/{}", &self.path, file), contents).unwrap()
    }

    pub fn make_dir(&self, path: &str) {
        fs::create_dir(format!("{}/{}", &self.path, path)).unwrap()
    }
}

pub struct Stream {
    stream: FtpStream,
    storage: Storage,
}

impl Stream {
    pub fn new(credentials: Credentials) -> Stream {
        let stream = credentials.connect();

        Stream {
            stream,
            storage: Storage::new(&credentials.out),
        }
    }

    /// download file from server cwd to local cwd
    pub fn download_file(&mut self, file: &str, folder: Option<&str>, name: &str) {
        println!("stream: download {}", file);
        let data = self.stream.simple_retr(file).unwrap().into_inner();
        self.storage.write(
            match folder {
                Some(f) => format!("{}/{}", f, name),
                None => name.to_string()
            },
            data,
        );
    }

    /// extracts files
    pub fn extract_files(&mut self, path: Option<&str>) -> Vec<FileData> {
        let stream = &mut self.stream; // convenience

        let names = stream.nlst(path).expect("Couldn't get names");
        let detailed = stream.list(path).expect("Couldn't get detailed names");

        assert_eq!(names.len(), detailed.len());

        let mut out: Vec<FileData> = vec![];

        for (index, name) in names.into_iter().enumerate() {
            let detailed_item = detailed.index(index);
            let is_dir: bool = detailed_item.contains("<DIR>");
            out.push((
                name,
                if is_dir {
                    ItemType::Dir
                } else {
                    ItemType::File
                },
            ));
        }

        out
    }

    fn navigate(&mut self, path: &str) {
        println!("stream: navigate {}", path);
        self.stream.cwd(path).unwrap();
    }

    pub fn download_dir(&mut self, wd: &str, name: &str, folder: Option<&str>) {
        if let Some(f) = folder {
            self.storage.make_dir(&f);
        }
        
        self.navigate(&wd); 
        let files = self.extract_files(Some(&name));
        let length = files.len();

        for (index, file) in files.into_iter().enumerate() {
            println!("stream: [{}/{}]: download {:?}", index + 1, length, file);
            self.navigate(&wd);

            match &file.1 {
                ItemType::Dir => {
                    let wd = format!("{}/{}", wd, name);
                    let folder = match folder {
                        Some(f) => format!("{}/{}", f, file.0),
                        None => file.0.to_string(),
                    };
                    println!("folder {}", folder);
                    self.download_dir(&wd, &file.0, Some(&folder));
                }
                ItemType::File => {
                    self.download_file(&format!("{}/{}", name, file.0), folder, &file.0)
                }
            }
        }

        // self.storage.make_dir();

        // let files = self.extract_files(path);

        // for (index, file) in files.into_iter().enumerate() {
        //     println!("{}", file.0);

        //     let dir_path = match path {
        //         Some(p) => format!("{}/{}", p, file.0),
        //         None => file.0,
        //     };

        //     if let ItemType::Dir = file.1 {
        //         println!("stream: [{}/{}] download dir {}", index + 1, length, dir_path);

        //         self.download_dir(Some(&dir_path));
        //         continue;
        //     }

        //     self.download_file(&dir_path);

        //     println!("stream: [{}/{}] downloaded {}", index + 1, length, dir_path);
        // }
    }
}
