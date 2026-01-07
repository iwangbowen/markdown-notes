# Tag System User Guide

## Overview

The tag system allows you to organize and search your notes using tags stored in YAML front matter. Tags make it easy to categorize notes and find related content across different notebooks.

## Creating Notes with Tags

When creating a new note:

1. **Enter Note Name**: Type your note name (e.g., "Meeting Notes")
2. **Enter Tags** (Optional): When prompted, enter comma-separated tags
   - Example: `work, meeting, important`
   - Tags are case-insensitive for searching
   - Spaces around commas are automatically trimmed

### Example

```markdown
---
title: Meeting Notes
created: 2026-01-08T10:30:00.000Z
updated: 2026-01-08T10:30:00.000Z
tags:
  - work
  - meeting
  - important
---

# Meeting Notes

Your content here...
```

## YAML Front Matter Format

All new notes automatically include YAML front matter with the following fields:

- **title**: Note title (auto-generated from note name)
- **created**: Creation timestamp in ISO 8601 format
- **updated**: Last update timestamp in ISO 8601 format
- **tags**: Array of tags (optional)

### Supported Tag Formats

**Multi-line array** (recommended for multiple tags):

```yaml
tags:
  - work
  - meeting
  - important
```

**Inline array**:

```yaml
tags: [work, meeting, important]
```

**Single tag**:

```yaml
tags: [work]
```

## Searching by Tags

### Using the Search Command

1. **Open Search**: Press `Ctrl+Shift+F` or click "Search Notes" button
2. **Enter Search Query**:
   - Enter keywords to search in note content (optional)
   - Leave empty to search by tags only
3. **Enter Tags**: When prompted, enter tags to filter by
   - Example: `work, meeting`
   - **OR Logic**: Matches notes with ANY of the specified tags
4. **View Results**: Results show matched notes with tags displayed

### Search Examples

#### Search by Content Only

- Query: `project plan`
- Tags: *(leave empty)*
- Result: All notes containing "project plan"

#### Search by Tags Only

- Query: *(leave empty)*
- Tags: `work, meeting`
- Result: All notes tagged with "work" OR "meeting"

#### Combined Search

- Query: `budget`
- Tags: `work, important`
- Result: Notes containing "budget" AND tagged with "work" OR "important"

### Tag Matching Logic

- **Case-Insensitive**: `Work`, `work`, and `WORK` are treated the same
- **OR Logic**: Searching for `work, meeting` matches notes with either tag
- **Exact Match**: Tag must match exactly (no partial matching)

## Search Results Display

Search results show:

- **Note Name**: Name of the matching note
- **Location**: Line number and notebook name
- **Tags**: All tags associated with the note (if any)
- **Preview**: Matching line content

Example result:

```
📄 Meeting Notes
Line 15 · Work Notes [work, meeting, important]
Budget discussion for Q1 project...
```

## Managing Tags

### Adding Tags to Existing Notes

1. Open the note in the editor
2. Add or modify the YAML front matter at the top:

   ```yaml
   ---
   title: Your Note Title
   created: 2026-01-08T10:00:00.000Z
   updated: 2026-01-08T11:00:00.000Z
   tags:
     - new-tag
     - another-tag
   ---
   ```

3. Save the file
4. Tags will be automatically extracted on next search

### Removing Tags

- Delete the `tags` field from front matter, or
- Set it to an empty array: `tags: []`

### Renaming Tags

To rename a tag across all notes:

1. Use VS Code's global search and replace
2. Search for the old tag in YAML format
3. Replace with the new tag

## Best Practices

### Tag Naming

- Use lowercase for consistency
- Use hyphens for multi-word tags: `project-plan`, not `project plan`
- Keep tags short and descriptive
- Avoid special characters except hyphens and underscores

### Tag Organization

- **Category Tags**: `work`, `personal`, `study`
- **Status Tags**: `draft`, `review`, `completed`
- **Priority Tags**: `urgent`, `important`, `low-priority`
- **Topic Tags**: `meeting`, `project`, `idea`, `research`

### Example Tag System

```yaml
# Work meeting notes
tags: [work, meeting, team-sync]

# Personal project ideas
tags: [personal, project, idea, tech]

# Important work documents
tags: [work, important, reference, documentation]

# Study notes
tags: [study, computer-science, algorithms]
```

## Advanced Features

### Viewing All Tags

Currently, there's no built-in tag browser, but you can:

1. Use VS Code's global search for `tags:`
2. View all front matter sections
3. Extract unique tags manually

### Tag Statistics

To see tag usage:

1. Search with empty query
2. Enter specific tag
3. Count results shown

## Troubleshooting

### Tags Not Showing in Search

1. **Check Front Matter Format**: Ensure YAML is properly formatted
2. **Reload Extension**: Press `F5` in Extension Development Host
3. **Verify File Saved**: Tags are extracted when reading files

### Search Not Finding Tagged Notes

1. **Verify Tag Spelling**: Tags must match exactly (case-insensitive)
2. **Check YAML Syntax**: Use array format `tags: [tag1, tag2]`
3. **Re-save Note**: Sometimes a file save triggers re-indexing

### Front Matter Not Generated

- Only new notes created after v0.3.0 have automatic front matter
- Existing notes need manual front matter addition

## Migration from Older Versions

If you have notes created before v0.3.0:

1. **Manual Addition**: Add front matter to important notes manually
2. **Template**: Use this template:

   ```yaml
   ---
   title: Note Title
   created: YYYY-MM-DDTHH:mm:ss.sssZ
   updated: YYYY-MM-DDTHH:mm:ss.sssZ
   tags: []
   ---
   ```

3. **Gradual Migration**: Add front matter as you edit notes

## Technical Details

### YAML Parser

- Custom lightweight YAML parser
- Supports basic key-value pairs and arrays
- No external dependencies
- Fast and efficient

### Storage

- Tags stored in file content (YAML front matter)
- No separate index or database
- Tags extracted on-demand when listing/searching notes
- No impact on Git operations

### Performance

- Tag extraction: O(n) per file
- Search with tags: Filters before content search
- Minimal overhead for notes without tags

## Future Enhancements

Potential improvements for future versions:

- Tag autocomplete during input
- Tag browser/manager UI
- Tag statistics and analytics
- Bulk tag operations
- Tag hierarchies (parent/child tags)
- Tag color coding
