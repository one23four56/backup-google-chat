use backup_service;

fn main() {
    let credentials = backup_service::get_credentials();

    println!("main: Found credentials");
    credentials.print();

    println!("main: Attempting login");
    let mut stream = backup_service::Stream::new(credentials);
    println!("main: Connection established");

    stream.download_dir("/site/wwwroot", "bgc", None);
    println!("Download finished")

}
