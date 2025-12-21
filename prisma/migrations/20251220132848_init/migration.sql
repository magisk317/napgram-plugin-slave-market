-- CreateTable
CREATE TABLE "slave_market_players" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "plainUserId" TEXT,
    "nickname" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "worth" INTEGER NOT NULL DEFAULT 100,
    "creditLevel" INTEGER NOT NULL DEFAULT 1,
    "depositLimit" INTEGER NOT NULL DEFAULT 1000,
    "loanBalance" INTEGER NOT NULL DEFAULT 0,
    "loanCreditLevel" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT,
    "ownedTime" BIGINT,
    "vipEndTime" BIGINT,
    "registerTime" BIGINT NOT NULL,
    "registerSource" TEXT,
    "lastWorkTime" BIGINT,
    "lastRobTime" BIGINT,
    "lastTransferTime" BIGINT,
    "lastBuyTime" BIGINT,
    "lastPlantTime" BIGINT,
    "lastHarvestTime" BIGINT,
    "lastInterestTime" BIGINT,
    "lastLoanInterestTime" BIGINT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "commandBanned" BOOLEAN NOT NULL DEFAULT false,
    "bodyguardName" TEXT,
    "bodyguardEndTime" BIGINT,
    "jailEndTime" BIGINT,
    "jailWorkIncome" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "slave_market_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_transactions" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "targetId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slave_market_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_farm_lands" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "plotIndex" INTEGER NOT NULL,
    "cropType" TEXT,
    "plantTime" BIGINT,
    "harvestTime" BIGINT,

    CONSTRAINT "slave_market_farm_lands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_appearances" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slave_market_appearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_red_packets" (
    "id" SERIAL NOT NULL,
    "packetId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slave_market_red_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_red_packet_grabs" (
    "id" SERIAL NOT NULL,
    "packetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "grabbedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slave_market_red_packet_grabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_vip_cards" (
    "id" SERIAL NOT NULL,
    "cardCode" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slave_market_vip_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_system" (
    "id" SERIAL NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "lastAssetDecayTime" BIGINT,
    "metadata" JSONB,

    CONSTRAINT "slave_market_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_market_admins" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slave_market_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_players_userId_key" ON "slave_market_players"("userId");

-- CreateIndex
CREATE INDEX "slave_market_players_userId_idx" ON "slave_market_players"("userId");

-- CreateIndex
CREATE INDEX "slave_market_players_ownerId_idx" ON "slave_market_players"("ownerId");

-- CreateIndex
CREATE INDEX "slave_market_players_registerSource_idx" ON "slave_market_players"("registerSource");

-- CreateIndex
CREATE INDEX "slave_market_transactions_userId_createdAt_idx" ON "slave_market_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "slave_market_transactions_type_idx" ON "slave_market_transactions"("type");

-- CreateIndex
CREATE INDEX "slave_market_farm_lands_userId_idx" ON "slave_market_farm_lands"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_farm_lands_userId_plotIndex_key" ON "slave_market_farm_lands"("userId", "plotIndex");

-- CreateIndex
CREATE INDEX "slave_market_appearances_userId_equipped_idx" ON "slave_market_appearances"("userId", "equipped");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_appearances_userId_itemName_key" ON "slave_market_appearances"("userId", "itemName");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_red_packets_packetId_key" ON "slave_market_red_packets"("packetId");

-- CreateIndex
CREATE INDEX "slave_market_red_packets_scopeKey_idx" ON "slave_market_red_packets"("scopeKey");

-- CreateIndex
CREATE INDEX "slave_market_red_packets_createdAt_idx" ON "slave_market_red_packets"("createdAt");

-- CreateIndex
CREATE INDEX "slave_market_red_packet_grabs_userId_idx" ON "slave_market_red_packet_grabs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_red_packet_grabs_packetId_userId_key" ON "slave_market_red_packet_grabs"("packetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_vip_cards_cardCode_key" ON "slave_market_vip_cards"("cardCode");

-- CreateIndex
CREATE INDEX "slave_market_vip_cards_used_idx" ON "slave_market_vip_cards"("used");

-- CreateIndex
CREATE INDEX "slave_market_vip_cards_cardCode_idx" ON "slave_market_vip_cards"("cardCode");

-- CreateIndex
CREATE UNIQUE INDEX "slave_market_admins_userId_key" ON "slave_market_admins"("userId");

-- AddForeignKey
ALTER TABLE "slave_market_players" ADD CONSTRAINT "slave_market_players_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "slave_market_players"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_market_transactions" ADD CONSTRAINT "slave_market_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "slave_market_players"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_market_farm_lands" ADD CONSTRAINT "slave_market_farm_lands_userId_fkey" FOREIGN KEY ("userId") REFERENCES "slave_market_players"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_market_appearances" ADD CONSTRAINT "slave_market_appearances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "slave_market_players"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_market_red_packet_grabs" ADD CONSTRAINT "slave_market_red_packet_grabs_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "slave_market_red_packets"("packetId") ON DELETE CASCADE ON UPDATE CASCADE;
