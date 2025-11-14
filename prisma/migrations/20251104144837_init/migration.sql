-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "activity_key" VARCHAR(255),
    "title" VARCHAR(255),
    "response" TEXT,
    "date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER,
    "feedback_type" VARCHAR(50),
    "feedback_value" VARCHAR(255),
    "feedback_emoji" VARCHAR(10),
    "feedback_label" VARCHAR(255),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "text" TEXT,
    "completed" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 0,

    CONSTRAINT "daily_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_min_activities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "activity_key" VARCHAR(255),
    "title" VARCHAR(255),
    "date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 0,

    CONSTRAINT "five_min_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icompleted" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "achievement_text" TEXT,
    "image" VARCHAR(512),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 0,

    CONSTRAINT "icompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "not_to_dos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "habit" VARCHAR(255) NOT NULL,
    "date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 0,

    CONSTRAINT "not_to_dos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER,
    "user_id" INTEGER,
    "text" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_hashtags" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER,
    "hashtag" VARCHAR(100),

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER,
    "user_id" INTEGER,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "text" TEXT,
    "image" VARCHAR(255),
    "deleted" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 0,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL,
    "zip_code" VARCHAR(20),
    "gender" VARCHAR(20),
    "timezone" VARCHAR(50),
    "bio" TEXT,
    "occupation" VARCHAR(100),
    "age_group" VARCHAR(20),
    "address" TEXT,
    "hobbies" TEXT,
    "music_taste" VARCHAR(100),
    "phone_usage" VARCHAR(50),
    "fav_musician" VARCHAR(100),
    "fav_sports" VARCHAR(100),
    "indoor_time" VARCHAR(50),
    "outdoor_time" VARCHAR(50),
    "fav_work" VARCHAR(100),
    "fav_place" VARCHAR(100),
    "personality" VARCHAR(100),
    "movie_genre" VARCHAR(100),
    "likes_to_travel" SMALLINT,
    "profile_completed" SMALLINT DEFAULT 0,
    "profile_image" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "interests" TEXT,
    "goals" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(6),
    "version" INTEGER DEFAULT 0,
    "verified" SMALLINT DEFAULT 0,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_goals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "text" TEXT NOT NULL,
    "progress" INTEGER DEFAULT 0,
    "completed" SMALLINT DEFAULT 0,
    "week_start" TIMESTAMP(6),
    "feedback_entries" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "post_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "read" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_idx" ON "notifications"("recipient_id", "read");

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
