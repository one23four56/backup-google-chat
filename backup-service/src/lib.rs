use chrono;
use ftp::FtpStream;
use json;
use std::{
    fmt::Debug,
    fs,
    ops::Index,
    sync::{Arc, Mutex},
    thread::{self, JoinHandle},
};

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
    pub remote: String,
    threads: u8
}

/// gets credentials from config.json
pub fn get_credentials() -> Credentials {
    if let json::JsonValue::Object(object) = parse_json("config.json") {
        Credentials {
            url: object.get("url").unwrap().to_string(),
            user: object.get("user").unwrap().to_string(),
            password: object.get("password").unwrap().to_string(),
            out: object.get("out").unwrap().to_string(),
            remote: object.get("in").unwrap().to_string(),
            threads: object.get("threads").unwrap().as_u8().unwrap()
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
        println!("url:      {}", self.url);
        println!("user:     {}", self.user);
        println!("password: {}", self.password);
        println!("in:       {}", self.remote);
        println!("out:      {}", self.out);
        println!("threads:  {}", self.threads)
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

    pub fn clone(&self) -> Storage {
        Storage {
            path: self.path.to_owned(),
        }
    }
}

struct Stream {
    stream: FtpStream,
    storage: Storage,
}

impl Stream {
    pub fn new(credentials: &Credentials, storage: Storage) -> Stream {
        let stream = credentials.connect();

        Stream { stream, storage }
    }

    /// download file from server cwd to local cwd
    pub fn download_file(&mut self, file: &String, name: String) {
        println!("stream: download {}", file);
        let data = self.stream.simple_retr(file).unwrap().into_inner();
        self.storage.write(name, data);
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

    fn quit(&mut self) {
        self.stream.quit().unwrap();
    }
}

pub struct Backup {
    credentials: Credentials,
    storage: Storage,
}

impl Backup {
    pub fn new(credentials: Credentials) -> Backup {
        let storage = Storage::new(&credentials.out);

        Backup {
            credentials,
            storage,
        }
    }

    pub fn map(&self, wd: &str, name: &str) -> Vec<String> {
        let mut stream = Stream::new(&self.credentials, self.storage.clone());
        self.create_map(wd, name, None, &mut stream)
    }

    fn create_map(
        &self,
        wd: &str,
        name: &str,
        folder: Option<&str>,
        stream: &mut Stream,
    ) -> Vec<String> {
        let mut out: Vec<String> = vec![];

        if let Some(f) = folder {
            self.storage.make_dir(&f);
        }

        stream.navigate(&wd);
        let files = stream.extract_files(Some(&name));
        let length = files.len();

        for (index, file) in files.into_iter().enumerate() {
            println!("{} [{}/{}] map {:?}", name, index + 1, length, file);

            match &file.1 {
                ItemType::Dir => {
                    let wd = format!("{}/{}", wd, name);
                    let folder = match folder {
                        Some(f) => format!("{}/{}", f, file.0),
                        None => file.0.to_string(),
                    };

                    let mut res = self.create_map(&wd, &file.0, Some(&folder), stream);
                    out.append(&mut res);
                    stream.navigate(&wd);
                }
                ItemType::File => {
                    if file.0.ends_with(".backup") {
                        continue;
                    }

                    out.push(match folder {
                        Some(f) => format!("{}/{}", f, file.0),
                        None => file.0,
                    })
                }
            }
        }

        out
    }

    pub fn make_workers(&self, map: Arc<Mutex<Vec<String>>>, wd: &str) {
        let mut threads: Vec<JoinHandle<()>> = vec![];

        for _ in 1..self.credentials.threads {
            let thread = create_worker(
                Stream::new(&self.credentials, self.storage.clone()),
                map.clone(),
                wd.to_owned(),
            );

            threads.push(thread);
        }

        // fn keep_alive(threads: Vec<JoinHandle<()>>) {
        for thread in threads {
            thread.join().unwrap();
        }
        // }
    }
}

fn create_worker(stream: Stream, map: Arc<Mutex<Vec<String>>>, wd: String) -> JoinHandle<()> {
    thread::spawn(move || {
        fn helper(mut stream: Stream, map: Arc<Mutex<Vec<String>>>, wd: String) {
            let mut files = map.lock().unwrap();
            let file = (*files).pop();
            std::mem::drop(files); // release lock

            if let Some(file) = file {
                stream.download_file(&format!("{}/{}", wd, file), file);
                helper(stream, map, wd);
            } else {
                println!("Thread finished");
                stream.quit();
            }
        }

        helper(stream, map, wd);
    })
}

// for convenience
pub fn to_mutex(map: Vec<String>) -> Arc<Mutex<Vec<String>>> {
    Arc::new(Mutex::new(map))
}
