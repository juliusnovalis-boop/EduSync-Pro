CREATE TABLE "academic_years" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"status" text NOT NULL,
	"created_at" text,
	"updated_at" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "ai_access_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"resource" text,
	"action" text,
	"permission" text,
	"granted" boolean DEFAULT true,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"assistant_type" text NOT NULL,
	"model" text,
	"provider" text,
	"title" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"type" text NOT NULL,
	"content" text,
	"format" text,
	"related_student_id" text,
	"related_class_id" text,
	"conversation_id" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_support_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"class_id" text,
	"title" text,
	"content" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_usage_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"school_id" text,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"period_type" text NOT NULL,
	"period_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"school_id" text,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"provider" text,
	"model" text,
	"task_type" text,
	"capability" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "ambassadors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"establishment_id" text,
	"level" text,
	"status" text,
	"activation_date" text,
	"stats" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"metric" text,
	"period" text,
	"value" numeric,
	"metadata" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"body" text,
	"audience" text,
	"author_name" text,
	"priority" text,
	"date" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" text PRIMARY KEY NOT NULL,
	"login_id" text,
	"password_hash" text,
	"full_name" text,
	"email" text,
	"role" text,
	"status" text,
	"school_id" text,
	"must_change_password" boolean DEFAULT false,
	"last_login_at" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"subject_id" text,
	"class_id" text,
	"description" text,
	"due_date" text,
	"max_score" numeric,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text,
	"class_id" text,
	"date" text,
	"status" text,
	"reason" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "attendance_qr_records" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"student_id" text,
	"scanned_at" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text,
	"teacher_name" text,
	"date" text,
	"qr_token" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text,
	"target_id" text,
	"result" text,
	"metadata" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text,
	"event_type" text,
	"result" text,
	"details" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"description" text,
	"trigger" text,
	"condition" text,
	"action" text,
	"target_role" text,
	"enabled" boolean DEFAULT true,
	"created_by" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"level" text,
	"school_year" text,
	"capacity" integer,
	"room" text,
	"main_teacher_id" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "course_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text,
	"subject_id" text,
	"teacher_id" text,
	"day_of_week" integer,
	"start_time" text,
	"end_time" text,
	"room" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "digital_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"type" text,
	"student_id" text,
	"class_id" text,
	"data" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"code" text,
	"province_id" text,
	"city" text,
	"address" text,
	"phone" text,
	"email" text,
	"type" text,
	"director_name" text,
	"school_year" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"type" text,
	"start_date" text,
	"end_date" text,
	"description" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text,
	"subject_id" text,
	"class_id" text,
	"type" text,
	"value" numeric,
	"max_value" numeric,
	"term" text,
	"school_year" text,
	"date" text,
	"appreciation" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"school_id" text,
	"action" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"authors" text,
	"isbn" text,
	"publisher" text,
	"publication_year" integer,
	"edition" text,
	"subject" text,
	"level" text,
	"class_level" text,
	"language" text,
	"country" text,
	"education_system" text,
	"curriculum" text,
	"description" text,
	"cover_url" text,
	"resource_type" text,
	"source_type" text,
	"source_name" text,
	"source_url" text,
	"external_id" text,
	"access_mode" text,
	"rights_status" text,
	"license" text,
	"file_url" text,
	"scope" text,
	"school_id" text,
	"created_by" text,
	"created_at" text,
	"updated_at" text,
	"last_verified_at" text,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_name" text,
	"recipient_id" text,
	"recipient_type" text,
	"subject" text,
	"body" text,
	"status" text,
	"date" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text,
	"body" text,
	"priority" text,
	"read" boolean DEFAULT false,
	"action_url" text,
	"related_id" text,
	"related_type" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "parent_student_links" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_user_id" text NOT NULL,
	"student_id" text NOT NULL,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"establishment_id" text,
	"status" text,
	"integration_date" text,
	"public_info" text,
	"stats" text,
	"consent_given" boolean DEFAULT false,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text,
	"amount" numeric,
	"type" text,
	"method" text,
	"date" text,
	"month" text,
	"status" text,
	"reference" text,
	"note" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "pilot_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"establishment_id" text,
	"status" text,
	"start_date" text,
	"end_date" text,
	"config" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text,
	"email" text,
	"phone" text,
	"establishment_id" text
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"code" text,
	"capital" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"token" text,
	"title" text,
	"payload" text,
	"linked_id" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "qr_scan_history" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"type" text,
	"result" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"environment" text NOT NULL,
	"issued_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"status" text NOT NULL,
	"revoked_reason" text,
	"user_agent" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"gender" text,
	"birth_date" text,
	"matricule" text,
	"class_id" text,
	"user_id" text,
	"parent_name" text,
	"parent_phone" text,
	"parent_email" text,
	"address" text,
	"school_year" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"code" text,
	"coefficient" integer,
	"level" text,
	"color" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "teacher_class_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text,
	"school_year" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "teacher_establishment_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"establishment_id" text NOT NULL,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"gender" text,
	"email" text,
	"phone" text,
	"user_id" text,
	"subject_names" text[],
	"hire_date" text,
	"status" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"role" text,
	"created_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_counters_key_idx" ON "ai_usage_counters" USING btree ("environment","school_id","user_id","role","period_type","period_key");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_user_idx" ON "ai_usage_logs" USING btree ("environment","school_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_school_idx" ON "ai_usage_logs" USING btree ("environment","school_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_history_user_idx" ON "knowledge_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_resources_school_idx" ON "knowledge_resources" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "knowledge_resources_subject_idx" ON "knowledge_resources" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "knowledge_resources_level_idx" ON "knowledge_resources" USING btree ("level");--> statement-breakpoint
CREATE INDEX "knowledge_resources_rights_idx" ON "knowledge_resources" USING btree ("rights_status");--> statement-breakpoint
CREATE INDEX "knowledge_resources_access_idx" ON "knowledge_resources" USING btree ("access_mode");--> statement-breakpoint
CREATE INDEX "knowledge_resources_status_idx" ON "knowledge_resources" USING btree ("status");