const express = require('express');
const router = express.Router();
const ProjectsService = require('./projects.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

// Project Groups
router.get('/groups', (req, res, next) => {
    try {
        const groups = ProjectsService.getProjectGroups(req.portalId);
        res.json({ success: true, data: groups });
    } catch (err) {
        next(err);
    }
});

router.post('/groups', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { name, description, color } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Group name is required.' });
        const group = ProjectsService.createProjectGroup(req.portalId, { name, description, color });
        res.status(201).json({ success: true, data: group });
    } catch (err) {
        next(err);
    }
});

// Projects
router.get('/', (req, res, next) => {
    try {
        const projects = ProjectsService.getProjects(req.portalId, req.user.id, req.user.role, {
            projectType: req.query.type || 'active',
            projectGroupId: req.query.groupId
        });
        res.json({ success: true, data: projects });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { name, keyPrefix, ownerId, projectGroupId, description, startDate, endDate, isPublic, isStrictSchedule, isRollupProject, budgetConfig } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Project name is required.' });

        const project = ProjectsService.createProject({
            portalId: req.portalId,
            ownerId: ownerId || req.user.id,
            name,
            keyPrefix,
            projectGroupId,
            description,
            startDate,
            endDate,
            isPublic: isPublic !== undefined ? isPublic : 1,
            isStrictSchedule: isStrictSchedule ? 1 : 0,
            isRollupProject: isRollupProject ? 1 : 0,
            budgetConfig
        });
        res.status(201).json({ success: true, data: project });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req, res, next) => {
    try {
        const project = ProjectsService.getProjectById(req.portalId, req.params.id);
        res.json({ success: true, data: project });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const project = ProjectsService.updateProject(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: project });
    } catch (err) {
        next(err);
    }
});

// List Project Members
router.get('/:id/members', (req, res, next) => {
    try {
        const members = ProjectsService.getProjectMembers(req.portalId, req.params.id);
        res.json({ success: true, data: members });
    } catch (err) {
        next(err);
    }
});

// Share Project via Email / Add Project Member (Requires Admin, Manager, or Project Owner)
router.post('/:id/share', async (req, res, next) => {
    try {
        const { email, role } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Recipient email is required.' });
        }

        const project = ProjectsService.getProjectById(req.portalId, req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found.' });
        }

        // Authorization Guard: Only project owners, managers, or admins can share
        const isOwner = project.owner_id === req.user?.id;
        const isAdminOrManager = ['admin', 'manager'].includes(req.user?.role);
        if (!isAdminOrManager && !isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Only project owners, managers, or administrators can share projects.'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await ProjectsService.shareProject(req.portalId, req.params.id, {
            email,
            role: role || 'member',
            inviterId: req.user?.id,
            inviterName: req.user?.name || 'Administrator',
            inviterEmail: req.user?.email,
            baseUrl
        });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Deep Clone Project (copy_from)
router.post('/:id/clone', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { newName, startDate } = req.body;
        if (!newName) return res.status(400).json({ success: false, error: 'New project name is required.' });

        const cloned = ProjectsService.cloneProject(req.portalId, req.params.id, newName, req.user.id, startDate);
        res.status(201).json({ success: true, data: cloned });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const permanent = req.query.permanent === 'true';
        const result = ProjectsService.deleteProject(req.portalId, req.params.id, permanent);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

const ScenarioSimulatorEngine = require('../../engines/scenarioSimulatorEngine');
const RiskRadarEngine = require('../../engines/riskRadarEngine');

// Creative Engine: What-If Scenario Flight Simulator
router.get('/:id/simulate', (req, res, next) => {
    try {
        const milestoneSlipDays = parseInt(req.query.milestoneSlipDays || 0, 10);
        const laborCostMultiplier = parseFloat(req.query.laborCostMultiplier || 1.0);
        const simulation = ScenarioSimulatorEngine.simulate(req.portalId, req.params.id, {
            milestoneSlipDays,
            laborCostMultiplier
        });
        res.json({ success: true, data: simulation });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/simulate', (req, res, next) => {
    try {
        const { taskDelays, milestoneSlipDays, assigneeLeave, laborCostMultiplier } = req.body;
        const simulation = ScenarioSimulatorEngine.simulate(req.portalId, req.params.id, {
            taskDelays,
            milestoneSlipDays,
            assigneeLeave,
            laborCostMultiplier
        });
        res.json({ success: true, data: simulation });
    } catch (err) {
        next(err);
    }
});

// Creative Engine: Project Health Pulse & Risk Radar
router.get('/:id/pulse', (req, res, next) => {
    try {
        const pulse = RiskRadarEngine.analyze(req.portalId, req.params.id);
        res.json({ success: true, data: pulse });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
