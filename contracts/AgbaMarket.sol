// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
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
        bool resolved;
        bool outcome;
        address creator;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        mapping(address => bool) claimed;
    }

    mapping(uint256 => Market) private markets;
    uint256 public marketCount;
    address public immutable usdcToken;
    address public owner;
    uint256 public platformFeeBps = 150;

    event MarketCreated(uint256 indexed marketId, string question, string category, string country, uint256 resolvesAt);
    event Bet(uint256 indexed marketId, address indexed bettor, bool yes, uint256 amount);
    event Claim(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "usdc required");
        usdcToken = _usdcToken;
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
        require(bytes(question).length > 0, "question required");
        require(durationDays == 7 || durationDays == 14 || durationDays == 30, "invalid duration");
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

    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "market missing");
        require(!market.resolved, "already resolved");
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
        uint256 payout = userWinningBet + grossProfit - fee;
        market.claimed[msg.sender] = true;
        require(IERC20(usdcToken).transfer(msg.sender, payout), "payout failed");
        emit Claim(marketId, msg.sender, payout);
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
            market.resolved,
            market.outcome,
            market.creator
        );
    }

    function getUserBets(uint256 marketId, address user) external view returns (uint256 yes, uint256 no) {
        Market storage market = markets[marketId];
        return (market.yesBets[user], market.noBets[user]);
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
