use backup_service;

fn main() {
    let credentials = backup_service::get_credentials();

    println!("main: Found credentials");
    credentials.print();

    println!("main: Attempting login");
    let mut stream = credentials.connect();
    println!("main: Connection established");

    stream.cwd("/site/wwwroot").unwrap();

    let res = stream.list(None).unwrap();
    println!("{:?}", res);

    stream.quit().unwrap();

}
