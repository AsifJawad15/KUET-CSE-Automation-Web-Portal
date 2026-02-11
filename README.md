<div align="center">

# 🎓 KUET CSE Automation Web Portal

### A Comprehensive Academic Management System

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-blue?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 📖 About

The **KUET CSE Automation Web Portal** is a modern, full-featured academic management system designed specifically for the Computer Science and Engineering (CSE) department at Khulna University of Engineering & Technology (KUET). This platform streamlines administrative tasks, enhances communication between faculty and students, and provides a centralized hub for all academic activities.

### 🎯 Purpose

This portal aims to:
- Digitize and automate academic administrative processes
- Provide real-time access to academic information
- Facilitate efficient communication between stakeholders
- Reduce manual workload for faculty and administration
- Enhance the overall academic experience for students

---

## ✨ Features

### 👨‍🎓 Student Management
- ✅ Student registration and profile management
- ✅ Enrollment tracking and management
- ✅ CGPA calculation and academic records
- ✅ Batch, session, and section organization

### 👨‍🏫 Faculty Management
- ✅ Teacher profiles with designation tracking
- ✅ Leave management system
- ✅ Office room allocation
- ✅ Department-wise organization

### 📚 Course Management
- ✅ Course creation and curriculum management
- ✅ Course offerings by term and session
- ✅ Credit management and course types
- ✅ Syllabus tracking

### 🗓️ Class Scheduling
- ✅ Dynamic class routine generation
- ✅ Room allocation and availability tracking
- ✅ Conflict detection and resolution
- ✅ TV display mode for public schedules

### 📝 Attendance System
- ✅ Session-wise attendance tracking
- ✅ Teacher-marked attendance records
- ✅ Status tracking (Present, Absent, Late)
- ✅ Attendance reports and analytics

### 📊 Examination & Results
- ✅ Exam scheduling and management
- ✅ Multiple exam types (Midterm, Final, Quiz)
- ✅ Score entry and management
- ✅ Result publication system

### 📢 Notice Board
- ✅ Priority-based notice system
- ✅ Targeted announcements (term, batch, session)
- ✅ Expiration management
- ✅ Publication control

### 🏢 Resource Management
- ✅ Room database with capacity tracking
- ✅ Facility management
- ✅ Building-wise organization
- ✅ Active/inactive status tracking

### 🔐 Authentication & Authorization
- ✅ Role-based access control (Admin, Teacher, Student)
- ✅ Secure password hashing with bcrypt
- ✅ Email validation
- ✅ Session management

---

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React 18](https://react.dev/)** - UI library
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS 3.4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library
- **[GSAP](https://greensock.com/gsap/)** - Professional animation library
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library

### Backend & Database
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Supabase](https://supabase.com/)** - Backend as a Service
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - Password hashing

### Development Tools
- **[ESLint](https://eslint.org/)** - Code linting
- **[PostCSS](https://postcss.org/)** - CSS processing
- **[Autoprefixer](https://github.com/postcss/autoprefixer)** - CSS vendor prefixing

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) or **yarn** (v1.22 or higher)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/abdullahshahporan/KUET-CSE-Automation-Web-Portal.git
cd KUET-CSE-Automation-Web-Portal
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/kuet_cse_portal

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Database Setup

Initialize the database using the provided schema:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d your_database

# Import the schema
\\i database_schema.sql
```

Alternatively, if using Supabase, you can execute the SQL schema through the Supabase SQL Editor.

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 💻 Usage

### Development

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

### Accessing the Portal

1. **Landing Page**: Visit `http://localhost:3000` to access the homepage
2. **Sign In**: Navigate to `/Auth/SignIn` for authentication
3. **Sign Up**: Navigate to `/Auth/SignUp` for new user registration
4. **Dashboard**: After login, access role-specific dashboards

### Default User Roles

- **Admin**: Full system access with user management privileges
- **Teacher**: Access to course management, attendance, and grading
- **Student**: Access to enrollment, schedules, and academic records

---

## 📁 Project Structure

```
KUET-CSE-Automation-Web-Portal/
├── .github/                      # GitHub configuration
│   └── copilot-instructions.md   # AI copilot instructions
├── public/                       # Static assets
│   └── grid.svg                  # UI graphics
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   └── globals.css           # Global styles
│   ├── Auth/                     # Authentication components
│   │   ├── AuthCard.tsx
│   │   ├── SignIn.tsx
│   │   └── SignUp.tsx
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # UI primitives
│   │   ├── HeroLanding.tsx
│   │   ├── HomePage.tsx
│   │   ├── Sidebar.tsx
│   │   └── ThemeToggle.tsx
│   ├── contexts/                 # React Context providers
│   ├── data/                     # Static data and constants
│   ├── Home/                     # Home module
│   │   └── dashboard.tsx
│   ├── modules/                  # Feature modules
│   │   ├── AddFaculty/           # Faculty addition
│   │   ├── AddStudent/           # Student addition
│   │   ├── ClassRoutine/         # Class scheduling
│   │   ├── CourseAllocation/     # Course assignment
│   │   ├── CourseInfo/           # Course information
│   │   ├── Dashboard/            # Dashboard views
│   │   ├── FacultyInfo/          # Faculty information
│   │   ├── Result/               # Result management
│   │   ├── RoomAllocation/       # Room management
│   │   ├── Schedule/             # Schedule management
│   │   ├── StudentInfo/          # Student information
│   │   ├── TVDisplay/            # Public display mode
│   │   └── TermUpgrade/          # Term progression
│   ├── services/                 # API service layers
│   │   ├── cmsService.ts         # Content management
│   │   ├── roomService.ts
│   │   ├── routineService.ts
│   │   ├── studentService.ts
│   │   ├── teacherService.ts
│   │   └── termUpgradeService.ts
│   ├── styles/                   # Additional styles
│   └── types/                    # TypeScript type definitions
│       ├── index.ts
│       └── cms.ts
├── database_schema.sql           # PostgreSQL database schema
├── .eslintrc.json                # ESLint configuration
├── .gitignore                    # Git ignore rules
├── next.config.ts                # Next.js configuration
├── package.json                  # Project dependencies
├── postcss.config.mjs            # PostCSS configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

---

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL database with the following main tables:

### Core Tables
- **profiles**: User authentication and role management
- **students**: Student-specific information
- **teachers**: Faculty information and designation
- **admins**: Administrative user details

### Academic Tables
- **courses**: Course catalog
- **curriculum**: Course-term mapping
- **course_offerings**: Active course instances
- **enrollments**: Student course registrations

### Scheduling Tables
- **rooms**: Classroom information
- **routine_slots**: Class schedule slots
- **class_sessions**: Individual class records

### Assessment Tables
- **exams**: Examination details
- **exam_scores**: Student exam results
- **attendance_records**: Class attendance

### Communication
- **notices**: Announcements and notifications

> 📄 For detailed schema information, see [database_schema.sql](./database_schema.sql)

---

## 🎨 UI/UX Features

- **Responsive Design**: Fully responsive across all device sizes
- **Dark Mode**: Integrated theme switching
- **Smooth Animations**: GSAP and Framer Motion powered animations
- **Modern UI**: Clean, professional interface with Tailwind CSS
- **Accessible**: WCAG compliant components
- **Performance Optimized**: Next.js 15 with App Router for optimal performance

---

## 🔐 Security Features

- ✅ Password hashing with bcrypt
- ✅ Email validation and sanitization
- ✅ Role-based access control (RBAC)
- ✅ Secure session management
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection (Next.js built-in)

---

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

---

## 📚 Documentation

- **API Documentation**: Coming soon
- **User Guide**: Coming soon
- **Admin Guide**: Coming soon
- **Development Guide**: See contribution guidelines below

---

## 🤝 Contributing

We welcome contributions from the community! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **Open a Pull Request**

### Coding Standards

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation as needed

---

## 🐛 Bug Reports & Feature Requests

Please use [GitHub Issues](https://github.com/abdullahshahporan/KUET-CSE-Automation-Web-Portal/issues) to report bugs or request features.

### Bug Report Template

```
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g., Windows, macOS, Linux]
- Browser: [e.g., Chrome, Firefox]
- Version: [e.g., 22]
```

---

## 📜 License

This project is currently under development. License information will be added soon.

---

## 👥 Authors & Contributors

- **Abdullah Shah Poran** - *Initial work* - [@abdullahshahporan](https://github.com/abdullahshahporan)

See also the list of [contributors](https://github.com/abdullahshahporan/KUET-CSE-Automation-Web-Portal/contributors) who participated in this project.

---

## 🙏 Acknowledgments

- KUET CSE Department for project requirements and support
- Next.js team for the amazing framework
- Supabase for backend infrastructure
- All contributors who help improve this project

---

## 📞 Contact & Support

- **Project Lead**: Abdullah Shah Poran
- **GitHub**: [@abdullahshahporan](https://github.com/abdullahshahporan)
- **Issue Tracker**: [GitHub Issues](https://github.com/abdullahshahporan/KUET-CSE-Automation-Web-Portal/issues)

---

## 🗺️ Roadmap

- [ ] Complete authentication system integration
- [ ] Implement real-time notifications
- [ ] Add email notification system
- [ ] Mobile application development
- [ ] Advanced analytics dashboard
- [ ] API documentation with Swagger
- [ ] Comprehensive test coverage
- [ ] Performance optimization
- [ ] Internationalization (i18n)
- [ ] Export functionality (PDF, Excel)

---

## 📊 Project Status

🚧 **Active Development** - This project is under active development. Features are being added regularly.

---

<div align="center">

### ⭐ Star this repository if you find it helpful!

Made with ❤️ by the KUET CSE Community

</div>
