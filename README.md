# Notes Management Application

A responsive full-stack notes application built with **HTML, CSS, JavaScript, Node.js, and Express**.

## Features
- Create, edit, and delete notes
- Search note titles, content, and categories
- Organize notes by Personal, Study, Work, Ideas, or a custom category
- Sort by last updated, title, or date created
- Save notes persistently in `data/notes.json`
- Responsive layout for desktop and mobile
- Input validation and delete confirmation

## Requirements
- Node.js 18 or newer
- npm (included with Node.js)

## Run locally
1. Download and extract this project.
2. Open the project folder in VS Code.
3. Open Terminal in VS Code (**Terminal → New Terminal**).
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the app:

   ```bash
   npm start
   ```

6. Open this address in your browser:

   `http://localhost:3000`

Keep the terminal running while using the app. Stop the server with `Ctrl + C`.

## Project structure
```text
notes-management-application/
├── data/
│   └── notes.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## GitHub repository setup
1. Sign in to GitHub and create a new **public** repository named `notes-management-application`.
2. Do not add a README or `.gitignore` during repository creation (this project already has them).
3. In the VS Code terminal, run these commands from this project folder. Replace `YOUR-USERNAME` with your GitHub username:

   ```bash
   git init
   git add .
   git commit -m "Complete Notes Management Application"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/notes-management-application.git
   git push -u origin main
   ```

4. Your repository link will be:

   `https://github.com/YOUR-USERNAME/notes-management-application`

5. Copy that actual repository URL into the GitHub project-link cell in your Excel sheet.

## Notes about data
Notes are stored in `data/notes.json` on the server. This is suitable for a classroom/demo project. For a production multi-user app, use a database and authentication.
