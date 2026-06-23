--
-- PostgreSQL database dump
--

\restrict maAEuaClfLSFKIRI10GuZlAVjisWTQDtR1NIg8YDDO2G29cagMJHQ88D0KWUgFp

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: seeval
--

INSERT INTO public."User" (id, email, name, organization, role, status, "passwordHash", "approvedAt", "lastLoginAt", "createdAt", "updatedAt") VALUES ('cmpzc6cux0000nxtgr22oxbah', 'jinoklee.01@gmail.com', 'Jinok Lee', 'Seoul National University', 'USER', 'ACTIVE', '$2b$12$lr/OdfKzrCjgbsb976VAf.ccbz4woxk6FQxc0uV85RV6rS5lXpEfG', '2026-06-04 10:12:33.531', '2026-06-04 10:13:36.296', '2026-06-04 10:12:16.665', '2026-06-04 10:13:36.296');
INSERT INTO public."User" (id, email, name, organization, role, status, "passwordHash", "approvedAt", "lastLoginAt", "createdAt", "updatedAt") VALUES ('cmpvf757q000rh2tg2zs55hnt', 'jojo9103@naver.com', '이고니', '아산병원', 'USER', 'ACTIVE', '$2b$12$qJZ9iQ8Y01tfgwjVNhCwJ.lxgxVqHYPMp0uSJj4.jDRh/Ukm9rSIG', '2026-06-01 16:28:31.732', '2026-06-02 14:52:36.124', '2026-06-01 16:25:47.558', '2026-06-02 14:52:36.125');
INSERT INTO public."User" (id, email, name, organization, role, status, "passwordHash", "approvedAt", "lastLoginAt", "createdAt", "updatedAt") VALUES ('cmpr14osv0001tstgie94ncsc', 'gun9103@naver.com', '이건희', '아산병원', 'USER', 'ACTIVE', '$2b$12$AW/WA30pghfwPJmODgjf5.jUsQd8kzlHV3Q6m7/R2M0TOnmO1dGAS', '2026-06-01 02:47:46.002', '2026-06-09 10:15:51.782', '2026-05-29 14:40:53.647', '2026-06-09 10:15:51.783');
INSERT INTO public."User" (id, email, name, organization, role, status, "passwordHash", "approvedAt", "lastLoginAt", "createdAt", "updatedAt") VALUES ('cmpy6y1t400000ltg8rl00osn', 'yonseidermatology@gmail.com', '연세대', '연세대', 'USER', 'ACTIVE', '$2b$12$dUhrU4qBL0btPOCS1oB1WeevQEeNYQV47GHsUTolOX0tp2.TIw8f.', '2026-06-03 14:59:49.086', '2026-06-13 02:20:24.055', '2026-06-03 14:58:04.84', '2026-06-13 02:20:24.055');
INSERT INTO public."User" (id, email, name, organization, role, status, "passwordHash", "approvedAt", "lastLoginAt", "createdAt", "updatedAt") VALUES ('cmpr0kay80000ldtggeiui27l', 'gun9103@gmail.com', 'SeeV Admin', 'SeeV', 'ADMIN', 'ACTIVE', '$2b$12$X5LvExAcNvYlsAHcewFJkeHzQAFAaGDUZglMEJG560tAizolthUmO', '2026-05-29 14:54:12.326', '2026-06-16 14:52:15.394', '2026-05-29 14:25:02.576', '2026-06-16 14:52:15.395');


--
-- PostgreSQL database dump complete
--

\unrestrict maAEuaClfLSFKIRI10GuZlAVjisWTQDtR1NIg8YDDO2G29cagMJHQ88D0KWUgFp

