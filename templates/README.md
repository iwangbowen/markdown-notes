# Note Templates

This directory contains built-in note templates for the Markdown Notes Manager extension.

## Built-in Templates

- **daily-note.md** - Daily notes with plan, summary, and notes sections
- **travel-journal.md** - Travel journal with itinerary, food, expenses, and photos
- **meeting-notes.md** - Meeting notes with agenda, discussion points, and action items
- **reading-notes.md** - Reading notes with book info, key points, quotes, and reflections
- **project-plan.md** - Project plan with goals, milestones, tasks, and risk assessment
- **blank.md** - Blank template for custom content

## Template Variables

Templates support the following variables that are automatically replaced when creating a note:

- `{{date}}` - Current date (YYYY-MM-DD)
- `{{time}}` - Current time (HH:MM:SS)
- `{{datetime}}` - Current date and time
- `{{title}}` - Note title

## Creating Custom Templates

Built-in templates cannot be edited directly through the extension. To create your own templates:

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "Markdown Notes: Create Template"
3. Enter a template name
4. Edit the template content
5. Click "Save Template"

Custom templates are stored in VS Code's global storage and automatically sync across devices.

You can also create custom templates based on built-in templates:

1. Open Command Palette
2. Run "Markdown Notes: Manage Templates"
3. Select a built-in template to preview its content
4. Create a new template with similar structure
