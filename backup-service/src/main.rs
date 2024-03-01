use backup_service;

fn main() {
    let credentials = backup_service::get_credentials();

    println!("main: Found credentials");
    credentials.print();

    let mut wd: Vec<&str> = credentials.remote.split("/").collect();
    let remote = format!("/{}", wd.join("/"));
    let name = wd.pop().unwrap().to_string();
    let wd = format!("/{}", wd.join("/"));

    let backup = backup_service::Backup::new(credentials);

    println!("main: Creating map");
    let map = backup.map(&wd, &name);
    let map = backup_service::to_mutex(map);
    println!("main: Map created");

    println!("main: running threads");
    backup.make_workers(map, &remote);
    println!("Backup done")
}
