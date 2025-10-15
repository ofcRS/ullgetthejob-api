import { relations } from "drizzle-orm/relations";
import { users, applications, jobs, cvs, customCvs, applicationQueue, parsedCvs } from "./schema";

export const applicationsRelations = relations(applications, ({one}) => ({
	user: one(users, {
		fields: [applications.userId],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [applications.jobId],
		references: [jobs.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	applications: many(applications),
	cvs: many(cvs),
	applicationQueues: many(applicationQueue),
	parsedCvs: many(parsedCvs),
}));

export const jobsRelations = relations(jobs, ({many}) => ({
	applications: many(applications),
	customCvs: many(customCvs),
	applicationQueues: many(applicationQueue),
}));

export const cvsRelations = relations(cvs, ({one, many}) => ({
	user: one(users, {
		fields: [cvs.userId],
		references: [users.id]
	}),
	customCvs: many(customCvs),
	applicationQueues: many(applicationQueue),
}));

export const customCvsRelations = relations(customCvs, ({one}) => ({
	cv: one(cvs, {
		fields: [customCvs.cvId],
		references: [cvs.id]
	}),
	job: one(jobs, {
		fields: [customCvs.jobId],
		references: [jobs.id]
	}),
}));

export const applicationQueueRelations = relations(applicationQueue, ({one}) => ({
	user: one(users, {
		fields: [applicationQueue.userId],
		references: [users.id]
	}),
	cv: one(cvs, {
		fields: [applicationQueue.cvId],
		references: [cvs.id]
	}),
	job: one(jobs, {
		fields: [applicationQueue.jobId],
		references: [jobs.id]
	}),
}));

export const parsedCvsRelations = relations(parsedCvs, ({one}) => ({
	user: one(users, {
		fields: [parsedCvs.userId],
		references: [users.id]
	}),
}));