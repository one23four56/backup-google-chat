use backup_service;

fn main() {
    let credentials = backup_service::get_credentials();

    println!("main: Found credentials");
    credentials.print();
    let backup = backup_service::Backup::new(credentials);

    println!("main: Creating map");
    let map = backup.map("/site/wwwroot", "bgc");
    let map = backup_service::to_mutex(map);
    println!("main: Map created");

    println!("main: running threads");
    backup.make_workers(30, map, "/site/wwwroot/bgc");
    // 30 threads lol
    println!("Backup done")
}
