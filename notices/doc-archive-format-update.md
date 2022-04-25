<!--title:Update to Official Archive Format:title-->
<!--date:2022-03-25:date-->
# Update to Official Archive Format

3/25/2022

The official archive format has been updated alongside the release of the archive module. The archive module will not work with the old format.

## Changes

The old archive format was as follows:

```json
{
    "messages": []
}
```

In the new format, the JSON itself is an array:

```json
[]
```

## Required Modification

If you have a local copy that was initialized before the new format was released, you will need to manually change the archive format in the messages.json file, as the archive is not tracked by git. Copies initialized after the new format was released will not need to do anything.
