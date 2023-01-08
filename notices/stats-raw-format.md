<!--title:Raw Stats Data Format:title-->
<!--date:2022-12-11:date-->

# Raw Stats Data Format

If you find yourself needing (or wanting) to analyze the statistics for a room more in-depth than the stats page offers, you are able to access the raw data used by the stats page. This can be done by opening the stats page and clicking 'View Raw Data', which is located at the bottom left corner of the page. This will open a prettified JavaScript Object Notation (JSON) file containing the raw data for every statistic currently displayed on the stats page. This page details what every entry in the JSON document means to allow you to use it effectively.

<hr>

If you do not know how to read JSON documents, check out [this tutorial](https://www.w3schools.com/js/js_json_intro.asp).

<hr>

This documentation is formatted in the following way:

    object: type
    description

        child: type 
            description

        child: type
            description

The types used are [standard TypeScript types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).

<hr>

# messages: {}

The `messages` object contains data about the number of messages sent. It is split into two sub-objects, `numbers` and `authors`.

> ## numbers: {}

> The `numbers` object contains the numbers of messages sent over different time periods.

> > ### allTime: number

> > > The total number of messages sent in the room

> > ### last7: number[]

> > > An array of numbers that is 7 items long. The first item is the number of messages sent today, the second is yesterday, the third is 2 days ago, etc.

> > ### today: number[]

> > > An array of numbers that is 12 items long. The first item is the number of messages sent this hour, the second is last hour, the third is two hours ago, etc.

> ## authors: {}

> The `authors` object contains multiple sub-objects that are all hashmaps where the a user's name is mapped to how many messages they sent over a given time period.

> > ### allTime: Map\<string, number\>

> > > The format described above, where the time period is all of time. Counts every message every user has sent.

> > ### last7: Map\<string, number\>

> > > The format described above, where the time period is the last 7 days.

> > ### today: Map\<string, number\>

> > > The format described above, where the time period is today.

# size: {}

The `size` object contains data about the size of the room.

> ## media: number

> > The number of bytes that all the media sent in the room takes up. Add with `messages` to get the total size.

> ## messages: number

> > The number of bytes that all the messages sent in the room take up. Add with `media` to get the total size.

# words: \[string, number\]\[\]

`words` is an array of tuples where the first item is a word and the second is the number of times it was used. For example, `["example", 5]` means that the word example was used 5 times. The `words` array contains up to 250 items.

# meta: {}

The `meta` object contains metadata about the room.

> ## name: string

> > The name of the room

> ## id: string

> > The room ID

> ## emoji: string

> > The room's emoji