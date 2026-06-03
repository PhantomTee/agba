// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AgbaMarket {
    struct Market {
        uint256 id;
        string question;
        string category;
        string sourceCountry;
        string newsHeadline;
        string newsUrl;
        uint256 createdAt;
        uint256 resolvesAt;
        uint256 yesPool;
        uint256 noPool;
        uint256 eurcYesPool;
        uint256 eurcNoPool;
        uint256 initialProbabilityYes;
        uint256 yieldEarned;
        bool resolved;
        bool outcome;
        address creator;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        mapping(address => uint256) eurcYesBets;
        mapping(address => uint256) eurcNoBets;
        mapping(address => bool) claimed;
        mapping(address => bool) eurcClaimed;
    }

    mapping(uint256 => Market) private markets;
    mapping(uint256 => uint256) public marketUsycBalance;
    mapping(uint256 => uint256) public marketUsycPrincipal;
    uint256 public marketCount;
    address public immutable usdcToken;
    address public immutable eurcToken;
    address public immutable usycToken;
    address public immutable usycTeller;
    address public owner;
    uint256 public platformFeeBps = 150;
    uint256 public accruedFees;
    uint256 public accruedEURCFees;

    event MarketCreated(uint256 indexed marketId, string question, string category, string country, uint256 resolvesAt);
    event Bet(uint256 indexed marketId, address indexed bettor, bool yes, uint256 amount);
    event EURCBet(uint256 indexed marketId, address indexed bettor, bool yes, uint256 amount);
    event Claim(uint256 indexed marketId, address indexed user, uint256 amount);
    event EURCClaim(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event MarketUSYCInvested(uint256 indexed marketId, uint256 usdcAmount, uint256 usycShares);
    event MarketUSYCRedeemed(uint256 indexed marketId, uint256 usdcReceived, uint256 yieldEarned);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _usdcToken, address _eurcToken, address _usycToken, address _usycTeller) {
        require(_usdcToken != address(0), "usdc required");
        require(_eurcToken != address(0), "eurc required");
        require(_usycToken != address(0), "usyc required");
        require(_usycTeller != address(0), "teller required");
        usdcToken = _usdcToken;
        eurcToken = _eurcToken;
        usycToken = _usycToken;
        usycTeller = _usycTeller;
        owner = msg.sender;
    }

    function createMarket(
        string calldata question,
        string calldata category,
        string calldata country,
        string calldata headline,
        string calldata newsUrl,
        uint256 durationDays
    ) external onlyOwner returns (uint256) {
        return _createMarket(question, category, country, headline, newsUrl, durationDays, 50);
    }

    function createMarket(
        string calldata question,
        string calldata category,
        string calldata country,
        string calldata headline,
        string calldata newsUrl,
        uint256 durationDays,
        uint256 initialProbabilityYes
    ) external onlyOwner returns (uint256) {
        return _createMarket(question, category, country, headline, newsUrl, durationDays, initialProbabilityYes);
    }

    function _createMarket(
        string calldata question,
        string calldata category,
        string calldata country,
        string calldata headline,
        string calldata newsUrl,
        uint256 durationDays,
        uint256 initialProbabilityYes
    ) internal returns (uint256) {
        require(bytes(question).length > 0, "question required");
        require(durationDays >= 1 && durationDays <= 180, "invalid duration");
        require(initialProbabilityYes <= 100, "invalid probability");
        marketCount += 1;
        Market storage market = markets[marketCount];
        market.id = marketCount;
        market.question = question;
        market.category = category;
        market.sourceCountry = country;
        market.newsHeadline = headline;
        market.newsUrl = newsUrl;
        market.createdAt = block.timestamp;
        market.resolvesAt = block.timestamp + durationDays * 1 days;
        market.initialProbabilityYes = initialProbabilityYes;
        market.creator = msg.sender;
        emit MarketCreated(marketCount, question, category, country, market.resolvesAt);
        return marketCount;
    }

    function bet(uint256 marketId, bool yes, uint256 amount) external {
        Market storage market = markets[marketId];
        require(market.id != 0, "market missing");
        require(!market.resolved, "resolved");
        require(block.timestamp < market.resolvesAt, "closed");
        require(amount > 0, "amount required");
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), amount), "transfer failed");
        if (yes) {
            market.yesPool += amount;
            market.yesBets[msg.sender] += amount;
        } else {
            market.noPool += amount;
            market.noBets[msg.sender] += amount;
        }
        emit Bet(marketId, msg.sender, yes, amount);
    }

    function betEURC(uint256 marketId, bool yes, uint256 amount) external {
        Market storage market = markets[marketId];
        require(market.id != 0, "market missing");
        require(!market.resolved, "resolved");
        require(block.timestamp < market.resolvesAt, "closed");
        require(amount > 0, "amount required");
        require(IERC20(eurcToken).transferFrom(msg.sender, address(this), amount), "transfer failed");
        if (yes) {
            market.eurcYesPool += amount;
            market.eurcYesBets[msg.sender] += amount;
        } else {
            market.eurcNoPool += amount;
            market.eurcNoBets[msg.sender] += amount;
        }
        emit EURCBet(marketId, msg.sender, yes, amount);
    }

    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "market missing");
        require(!market.resolved, "already resolved");
        _redeemMarketUSYC(marketId);
        market.resolved = true;
        market.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.resolved, "not resolved");
        require(!market.claimed[msg.sender], "claimed");
        uint256 userWinningBet = market.outcome ? market.yesBets[msg.sender] : market.noBets[msg.sender];
        require(userWinningBet > 0, "no winning bet");
        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;
        uint256 grossProfit = (losingPool * userWinningBet) / winningPool;
        uint256 fee = (grossProfit * platformFeeBps) / 10_000;
        uint256 yieldShare = market.yieldEarned > 0 ? (market.yieldEarned * userWinningBet) / winningPool : 0;
        uint256 payout = userWinningBet + grossProfit + yieldShare - fee;
        market.claimed[msg.sender] = true;
        accruedFees += fee;
        require(IERC20(usdcToken).transfer(msg.sender, payout), "payout failed");
        emit Claim(marketId, msg.sender, payout);
    }

    function claimEURCWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.resolved, "not resolved");
        require(!market.eurcClaimed[msg.sender], "claimed");
        uint256 userWinningBet = market.outcome ? market.eurcYesBets[msg.sender] : market.eurcNoBets[msg.sender];
        require(userWinningBet > 0, "no winning bet");
        uint256 winningPool = market.outcome ? market.eurcYesPool : market.eurcNoPool;
        uint256 losingPool = market.outcome ? market.eurcNoPool : market.eurcYesPool;
        uint256 grossProfit = (losingPool * userWinningBet) / winningPool;
        uint256 fee = (grossProfit * platformFeeBps) / 10_000;
        uint256 payout = userWinningBet + grossProfit - fee;
        market.eurcClaimed[msg.sender] = true;
        accruedEURCFees += fee;
        require(IERC20(eurcToken).transfer(msg.sender, payout), "payout failed");
        emit EURCClaim(marketId, msg.sender, payout);
    }

    function withdrawFees(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        require(amount <= accruedFees, "insufficient fees");
        accruedFees -= amount;
        require(IERC20(usdcToken).transfer(recipient, amount), "withdraw failed");
    }

    function withdrawEURCFees(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        require(amount <= accruedEURCFees, "insufficient fees");
        accruedEURCFees -= amount;
        require(IERC20(eurcToken).transfer(recipient, amount), "withdraw failed");
    }

    function investInUSYC(uint256 marketId, uint256 usdcAmount) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "market missing");
        require(!market.resolved, "resolved");
        require(usdcAmount > 0, "amount required");
        require(usdcAmount <= market.yesPool + market.noPool, "amount exceeds pool");
        uint256 beforeShares = IERC20(usycToken).balanceOf(owner);
        require(IERC20(usdcToken).approve(usycTeller, usdcAmount), "approve failed");
        bool success = _callUSYCTeller(usdcAmount);
        require(success, "usyc invest failed");
        uint256 shares = IERC20(usycToken).balanceOf(owner) - beforeShares;
        require(shares > 0, "no usyc received");
        marketUsycBalance[marketId] += shares;
        marketUsycPrincipal[marketId] += usdcAmount;
        emit MarketUSYCInvested(marketId, usdcAmount, shares);
    }

    function _redeemMarketUSYC(uint256 marketId) internal {
        uint256 shares = marketUsycBalance[marketId];
        if (shares == 0) return;
        uint256 principal = marketUsycPrincipal[marketId];
        uint256 beforeUsdc = IERC20(usdcToken).balanceOf(address(this));
        // Pull USYC from owner wallet (owner must have pre-approved this contract)
        require(IERC20(usycToken).transferFrom(owner, address(this), shares), "usyc pull failed");
        require(IERC20(usycToken).approve(usycTeller, shares), "approve failed");
        bool success = _callUSYCRedeem(shares);
        require(success, "usyc redeem failed");
        uint256 received = IERC20(usdcToken).balanceOf(address(this)) - beforeUsdc;
        uint256 yieldEarned = received > principal ? received - principal : 0;
        markets[marketId].yieldEarned = yieldEarned;
        marketUsycBalance[marketId] = 0;
        marketUsycPrincipal[marketId] = 0;
        emit MarketUSYCRedeemed(marketId, received, yieldEarned);
    }

    function _callUSYCTeller(uint256 usdcAmount) internal returns (bool) {
        // ERC-4626: deposit(uint256 assets, address receiver)
        (bool success,) = usycTeller.call(abi.encodeWithSignature("deposit(uint256,address)", usdcAmount, owner));
        if (success) return true;
        // Alternate subscription signature used by some teller wrappers
        (success,) = usycTeller.call(abi.encodeWithSignature("buy(uint256,address)", usdcAmount, owner));
        return success;
    }

    function _callUSYCRedeem(uint256 shares) internal returns (bool) {
        // ERC-4626: redeem(uint256 shares, address receiver, address owner)
        (bool success,) = usycTeller.call(abi.encodeWithSignature("redeem(uint256,address,address)", shares, owner, address(this)));
        if (success) return true;
        // Alternate redemption signature used by some teller wrappers
        (success,) = usycTeller.call(abi.encodeWithSignature("sell(uint256,address)", shares, owner));
        return success;
    }

    function getMarket(uint256 marketId)
        external
        view
        returns (
            uint256 id,
            string memory question,
            string memory category,
            string memory sourceCountry,
            string memory newsHeadline,
            string memory newsUrl,
            uint256 createdAt,
            uint256 resolvesAt,
            uint256 yesPool,
            uint256 noPool,
            uint256 initialProbabilityYes,
            bool resolved,
            bool outcome,
            address creator
        )
    {
        Market storage market = markets[marketId];
        return (
            market.id,
            market.question,
            market.category,
            market.sourceCountry,
            market.newsHeadline,
            market.newsUrl,
            market.createdAt,
            market.resolvesAt,
            market.yesPool,
            market.noPool,
            market.initialProbabilityYes,
            market.resolved,
            market.outcome,
            market.creator
        );
    }

    function getEURCPools(uint256 marketId) external view returns (uint256 yesPool, uint256 noPool) {
        Market storage market = markets[marketId];
        return (market.eurcYesPool, market.eurcNoPool);
    }

    function getUserBets(uint256 marketId, address user) external view returns (uint256 yes, uint256 no) {
        Market storage market = markets[marketId];
        return (market.yesBets[user], market.noBets[user]);
    }

    function getUserEURCBets(uint256 marketId, address user) external view returns (uint256 yes, uint256 no) {
        Market storage market = markets[marketId];
        return (market.eurcYesBets[user], market.eurcNoBets[user]);
    }

    function getMarketUSYCBalance(uint256 marketId) external view returns (uint256) {
        return marketUsycBalance[marketId];
    }

    function getMarketYieldEarned(uint256 marketId) external view returns (uint256) {
        return markets[marketId].yieldEarned;
    }

    function getOpenMarkets() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (!markets[i].resolved && markets[i].id != 0) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (!markets[i].resolved && markets[i].id != 0) ids[cursor++] = i;
        }
        return ids;
    }

    function getMarketsByCategory(string calldata category) external view returns (uint256[] memory) {
        bytes32 target = keccak256(bytes(category));
        uint256 count;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (keccak256(bytes(markets[i].category)) == target) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (keccak256(bytes(markets[i].category)) == target) ids[cursor++] = i;
        }
        return ids;
    }
}
